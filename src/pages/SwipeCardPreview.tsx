import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import SwipeCard from "../components/predictions/SwipeCard";

export default function SwipeCardPreview() {
  const { user } = useAuth();
  const [fixture, setFixture] = useState<any>(null);
  const [homeForm, setHomeForm] = useState<string | null>(null);
  const [awayForm, setAwayForm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        // Get current GW
        const { data: meta } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();

        const gw = meta?.current_gw || 17; // Fallback to GW 17

        // Get first fixture for that GW
        const { data: fixtures } = await supabase
          .from("app_fixtures")
          .select("*")
          .eq("gw", gw)
          .order("fixture_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fixtures) {
          setFixture(fixtures);

          // Fetch form data for both teams
          const { data: forms } = await supabase
            .from("app_team_forms")
            .select("team_code, form")
            .eq("gw", gw)
            .in("team_code", [
              fixtures.home_code?.toUpperCase(),
              fixtures.away_code?.toUpperCase(),
            ].filter(Boolean));

          if (forms) {
            const formsMap = new Map(forms.map(f => [f.team_code.toUpperCase(), f.form]));
            setHomeForm(formsMap.get(fixtures.home_code?.toUpperCase() || '') || null);
            setAwayForm(formsMap.get(fixtures.away_code?.toUpperCase() || '') || null);
          }
        }
      } catch (error) {
        console.error("Error loading preview:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="text-center text-slate-600">
          <p className="text-lg font-semibold mb-2">No fixtures found</p>
          <p className="text-sm">Publish a gameweek to see the swipe card preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md" style={{ height: '600px' }}>
        <SwipeCard
          fixture={{
            id: fixture.id,
            fixture_index: fixture.fixture_index,
            home_team: fixture.home_team || fixture.home_name || '',
            away_team: fixture.away_team || fixture.away_name || '',
            home_code: fixture.home_code,
            away_code: fixture.away_code,
            home_name: fixture.home_name,
            away_name: fixture.away_name,
            kickoff_time: fixture.kickoff_time,
          }}
          homeColor="#EF0107"
          awayColor="#034694"
          showSwipeHint={true}
          homeForm={homeForm}
          awayForm={awayForm}
        />
      </div>
    </div>
  );
}




