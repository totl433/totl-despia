import { Link } from 'react-router-dom';

export default function FloatingProfile() {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {/* How To Play Button */}
      <Link
        to="/how-to-play"
        className="w-12 h-12 rounded-full bg-[#1C8376] shadow-lg flex items-center justify-center hover:bg-[#178f72] transition-all"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
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
        className="w-12 h-12 rounded-full bg-[#1C8376] shadow-lg flex items-center justify-center hover:bg-[#178f72] transition-all"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
      >
        <img 
          src="/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png" 
          alt="Profile" 
          className="w-6 h-6"
        />
      </Link>
    </div>
  );
}

