# Predictions Storage Scalability Analysis

## Current Structure

### Table: `app_picks`
**File**: `supabase/sql/create_app_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS app_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  pick TEXT NOT NULL CHECK (pick IN ('H', 'D', 'A')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gw, fixture_index)
);
```

### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_app_picks_user_gw ON app_picks(user_id, gw);
CREATE INDEX IF NOT EXISTS idx_app_picks_gw ON app_picks(gw);
CREATE INDEX IF NOT EXISTS idx_app_picks_fixture ON app_picks(gw, fixture_index);
```

---

## Data Volume Analysis

### Per User
- **Predictions per gameweek**: ~10 (one per fixture)
- **Gameweeks per season**: ~38 (Premier League)
- **Total predictions per user per season**: ~380 rows

### Growth Projections

| Users | Rows/Season | Rows (5 seasons) | Rows (10 seasons) |
|-------|-------------|------------------|-------------------|
| 100   | 38,000      | 190,000         | 380,000          |
| 1,000 | 380,000     | 1.9M            | 3.8M             |
| 10,000| 3.8M        | 19M             | 38M              |
| 100,000| 38M       | 190M            | 380M             |

### Storage Size Estimate
- **Row size**: ~100 bytes (UUID + UUID + INT + INT + TEXT + timestamps)
- **1,000 users (1 season)**: ~38MB
- **10,000 users (1 season)**: ~380MB
- **100,000 users (1 season)**: ~3.8GB
- **100,000 users (10 seasons)**: ~38GB

---

## Query Patterns

### 1. Fetch User's Picks for a Gameweek
```sql
SELECT * FROM app_picks 
WHERE user_id = ? AND gw = ?;
```
**Index Used**: `idx_app_picks_user_gw` ✅ **OPTIMAL**
**Performance**: O(log n) - Very fast

### 2. Fetch All Picks for a Gameweek (Leaderboards)
```sql
SELECT * FROM app_picks 
WHERE gw = ?;
```
**Index Used**: `idx_app_picks_gw` ✅ **OPTIMAL**
**Performance**: O(log n + m) where m = users - Fast

### 3. Fetch Picks for a Specific Fixture
```sql
SELECT * FROM app_picks 
WHERE gw = ? AND fixture_index = ?;
```
**Index Used**: `idx_app_picks_fixture` ✅ **OPTIMAL**
**Performance**: O(log n) - Very fast

### 4. Fetch User's All-Time Picks
```sql
SELECT * FROM app_picks 
WHERE user_id = ?;
```
**Index Used**: Partial (user_id in composite index) ⚠️ **SUBOPTIMAL**
**Performance**: O(n) - Could be slow for users with many seasons

---

## Scalability Assessment

### ✅ **Current Structure is GOOD for:**
1. **Up to ~10,000 users**: Excellent performance
2. **Single-season queries**: All well-indexed
3. **Gameweek-specific queries**: All well-indexed
4. **Leaderboard calculations**: Efficient with current indexes

### ⚠️ **Potential Issues at Scale:**

#### 1. **Missing Index for User-Only Queries**
**Problem**: Queries filtering only by `user_id` (without `gw`) don't use an optimal index.

**Impact**: 
- Low for current usage (most queries include `gw`)
- Could be slow for "user's all-time stats" queries
- Becomes noticeable at 100K+ users with many seasons

**Solution**: Add index if needed:
```sql
CREATE INDEX IF NOT EXISTS idx_app_picks_user ON app_picks(user_id);
```

#### 2. **Table Growth Over Time**
**Problem**: Table grows linearly with users × seasons.

**Impact**:
- **10K users, 10 seasons**: ~38M rows - ✅ Manageable
- **100K users, 10 seasons**: ~380M rows - ⚠️ Large but manageable
- **1M users, 10 seasons**: ~3.8B rows - ❌ Needs optimization

**Solutions**:
- **Partitioning by season** (PostgreSQL 10+)
- **Archive old seasons** to separate table
- **Compression** for old data

#### 3. **Write Performance at Scale**
**Problem**: When many users submit predictions simultaneously (deadline rush).

**Impact**:
- **100 users**: No issue
- **1,000 users**: Minor contention
- **10,000+ users**: Could see lock contention on unique constraint

**Solutions**:
- Current unique constraint is fine
- Consider batch inserts for better performance
- Supabase handles this well with connection pooling

---

## Recommendations

### ✅ **Immediate (No Changes Needed)**
The current structure is **well-designed** and will scale to **~10,000 users** without issues.

### 🔧 **Optimizations for 10K-100K Users**

#### 1. Add User-Only Index (If Needed)
```sql
-- Only add if you see slow queries filtering by user_id alone
CREATE INDEX IF NOT EXISTS idx_app_picks_user ON app_picks(user_id);
```

**When to add**: If you implement "user's all-time stats" features that query without `gw`.

#### 2. Monitor Query Performance
- Use Supabase dashboard to monitor slow queries
- Add indexes based on actual query patterns
- Don't over-index (indexes slow down writes)

#### 3. Consider Composite Index Optimization
Current indexes are good, but you could optimize the most common query:
```sql
-- If most queries are user_id + gw, this is already covered
-- by idx_app_picks_user_gw
```

### 🚀 **Optimizations for 100K+ Users**

#### 1. Table Partitioning by Season
```sql
-- Partition by season (year)
CREATE TABLE app_picks_2024 PARTITION OF app_picks
  FOR VALUES FROM (1) TO (39); -- GW 1-38

CREATE TABLE app_picks_2025 PARTITION OF app_picks
  FOR VALUES FROM (39) TO (77); -- GW 39-76
```

**Benefits**:
- Faster queries (smaller partitions)
- Easier data archival
- Better maintenance

**When**: Only needed at 100K+ users with multiple seasons.

#### 2. Archive Old Seasons
```sql
-- Move old seasons to archive table
CREATE TABLE app_picks_archive (LIKE app_picks INCLUDING ALL);

-- Move data older than 2 seasons
INSERT INTO app_picks_archive
SELECT * FROM app_picks WHERE gw < (current_gw - 76);
DELETE FROM app_picks WHERE gw < (current_gw - 76);
```

**Benefits**:
- Keeps main table smaller
- Faster queries on recent data
- Can still query archive if needed

#### 3. Consider JSON Storage (Advanced)
**Alternative Structure** (not recommended unless needed):
```sql
CREATE TABLE app_picks_json (
  user_id UUID,
  gw INTEGER,
  picks JSONB, -- {"1": "H", "2": "D", ...}
  PRIMARY KEY (user_id, gw)
);
```

**Pros**:
- Fewer rows (1 per user per GW)
- Faster for fetching all picks for a GW

**Cons**:
- Harder to query individual picks
- Less flexible
- JSONB indexes are more complex

**Verdict**: ❌ **Not recommended** - Current structure is better.

---

## Comparison: Current vs Alternatives

### Current Structure (Row-Based)
```
app_picks: (user_id, gw, fixture_index, pick)
- 380 rows per user per season
- Easy to query individual picks
- Well-indexed
- Standard relational pattern
```

### Alternative: JSON Storage
```
app_picks_json: (user_id, gw, picks: JSONB)
- 38 rows per user per season (10x fewer)
- Harder to query
- Requires JSONB indexes
- Less flexible
```

### Alternative: Column-Based (Not Recommended)
```
app_picks_columns: (user_id, gw, pick_1, pick_2, ..., pick_10)
- 38 rows per user per season
- Schema changes if fixtures change
- Harder to maintain
```

**Winner**: ✅ **Current structure** is the best choice.

---

## Performance Benchmarks (Estimated)

### Query Performance (with current indexes)

| Query Type | 1K Users | 10K Users | 100K Users |
|------------|----------|-----------|------------|
| User's GW picks | <1ms | <1ms | <5ms |
| All picks for GW | <10ms | <50ms | <200ms |
| Fixture picks | <1ms | <1ms | <5ms |
| User all-time | <10ms | <100ms | <1s ⚠️ |

### Write Performance

| Operation | 1K Users | 10K Users | 100K Users |
|-----------|----------|-----------|------------|
| Insert pick | <5ms | <10ms | <20ms |
| Batch insert (10 picks) | <20ms | <50ms | <100ms |

---

## Supabase-Specific Considerations

### Connection Pooling
- Supabase uses PgBouncer for connection pooling
- Handles concurrent writes well
- No changes needed

### Row Level Security (RLS)
- Current RLS policies are efficient
- No performance impact at scale

### Real-time Subscriptions
- Real-time on `app_picks` works well
- Consider limiting subscriptions to current GW only
- Monitor connection limits at scale

---

## Action Plan

### Phase 1: Current (0-10K users) ✅
**Status**: No changes needed
- Current structure is optimal
- All queries well-indexed
- Monitor query performance

### Phase 2: Growth (10K-100K users)
**Actions**:
1. ✅ Monitor slow queries in Supabase dashboard
2. ⚠️ Add `idx_app_picks_user` if user-only queries become slow
3. ⚠️ Consider partitioning if table exceeds 50M rows
4. ✅ Optimize leaderboard queries (use views/materialized views)

### Phase 3: Scale (100K+ users)
**Actions**:
1. ✅ Implement table partitioning by season
2. ✅ Archive old seasons (>2 years old)
3. ✅ Consider read replicas for leaderboard queries
4. ✅ Implement caching layer for frequently accessed data

---

## Conclusion

### ✅ **Current Structure is Sustainable**

**For your use case**:
- **Current scale**: ✅ Excellent
- **Up to 10K users**: ✅ No changes needed
- **10K-100K users**: ✅ Minor optimizations may help
- **100K+ users**: ⚠️ Consider partitioning/archiving

### Key Takeaways

1. **Current indexes are well-designed** - cover all common query patterns
2. **Row-based structure is optimal** - don't switch to JSON
3. **Monitor before optimizing** - add indexes based on actual slow queries
4. **Partitioning is future-proof** - can implement when needed
5. **Supabase handles scale well** - connection pooling and RLS are efficient

### Recommendation

**No immediate changes needed.** The current structure will scale to **10,000+ users** without issues. Monitor query performance as you grow, and consider optimizations (partitioning, archiving) only when you approach 100K users or see actual performance issues.

---

**Last Updated**: 2025-01-XX



