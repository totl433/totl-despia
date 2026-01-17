import { Link } from'react-router-dom';
import { useEffect, useState } from'react';
import { isDespiaAvailable } from '../lib/platform';

export default function FloatingProfile() {
 const [bannerHeight, setBannerHeight] = useState(0);
 const isNativeApp = isDespiaAvailable();

 useEffect(() => {
 // Check if banner is visible and get its height
 const checkBanner = () => {
 // Look for the banner using the data attribute or class
 const banner = document.querySelector('.gameweek-banner, [data-banner-height]');
 
 if (banner) {
 const rect = banner.getBoundingClientRect();
 // Only count if banner is actually visible and at the top of the page
 if (rect.height > 0 && rect.top >= 0 && rect.top < 200) {
 setBannerHeight(rect.height);
 return;
 }
 }
 
 // Fallback: look for banner by background color if data attribute not found
 const banners = document.querySelectorAll('[style*="background-color: #1C8376"], [style*="background-color: #e1eae9"]');
 let maxHeight = 0;
 
 banners.forEach((b) => {
 const rect = b.getBoundingClientRect();
 // Check if it's at the top and has reasonable height
 if (rect.top >= 0 && rect.top < 200 && rect.height > 40 && rect.height < 200) {
 maxHeight = Math.max(maxHeight, rect.height);
 }
 });
 
 setBannerHeight(maxHeight);
 };

 // Initial check
 const timeoutId = setTimeout(checkBanner, 100);
 
 // Use MutationObserver to watch for DOM changes (banner appearing/disappearing)
 const observer = new MutationObserver(() => {
 setTimeout(checkBanner, 50);
 });
 observer.observe(document.body, { childList: true, subtree: true });
 
 // Also check on resize and scroll
 window.addEventListener('resize', checkBanner);
 window.addEventListener('scroll', checkBanner);
 
 return () => {
 clearTimeout(timeoutId);
 observer.disconnect();
 window.removeEventListener('resize', checkBanner);
 window.removeEventListener('scroll', checkBanner);
 };
 }, []);

 // Position below banner with some spacing (1rem = 16px spacing)
 // Default to 16px (top-4) if no banner, otherwise banner height + 16px spacing
 const topPosition = bannerHeight > 0 ? bannerHeight + 16 : 16;
 const topStyle = isNativeApp
   ? `calc(${topPosition}px + var(--safe-area-top))`
   : `${topPosition}px`;

 return (
 <div className="fixed right-4 z-50 flex items-center gap-2" style={{ top: topStyle, transition:'top 0.2s ease-in-out' }}>
 {/* How To Play Button */}
 <Link
 to="/how-to-play"
 className="w-12 h-12 rounded-full bg-[#1C8376] shadow-lg flex items-center justify-center"
 style={{ boxShadow:'0 4px 12px rgba(0, 0, 0, 0.3)' }}
 >
 <img 
 src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png" 
 alt="How To Play" 
 className="w-6 h-6"
 />
 </Link>
 
 {/* Profile Button */}
 <Link
 to="/profile"
 className="w-12 h-12 rounded-full bg-[#1C8376] shadow-lg flex items-center justify-center"
 style={{ boxShadow:'0 4px 12px rgba(0, 0, 0, 0.3)' }}
 >
 <img 
 src="/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png" 
 alt="Profile" 
 className="w-6 h-6"
 />
 </Link>
 </div>);
}

