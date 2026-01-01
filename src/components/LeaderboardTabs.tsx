type Tab = 'overall' | 'form5' | 'form10' | 'lastgw';

type LeaderboardTabsProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function LeaderboardTabs({ activeTab, onTabChange }: LeaderboardTabsProps) {
  return (
    <div className="flex justify-center mb-6">
      <div className="flex rounded-full bg-slate-100 p-1.5 border border-slate-200 shadow-sm w-full max-w-md">
        <button
          onClick={() => onTabChange("lastgw")}
          className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
            activeTab === "lastgw"
              ? "bg-[#1C8376] text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          GW
        </button>
        <button
          onClick={() => onTabChange("form5")}
          className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
            activeTab === "form5"
              ? "bg-[#1C8376] text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          5
        </button>
        <button
          onClick={() => onTabChange("form10")}
          className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
            activeTab === "form10"
              ? "bg-[#1C8376] text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          10
        </button>
        <button
          onClick={() => onTabChange("overall")}
          className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all flex items-center justify-center ${
            activeTab === "overall"
              ? "bg-[#1C8376] text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-5 h-5">
            <g>
              <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}

































