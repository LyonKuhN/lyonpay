import type { ReactNode } from 'react';

interface SkewCardProps {
  step: string;
  title: string;
  desc: string;
  icon: ReactNode;
  gradientFrom: string;
  gradientTo: string;
}

export function SkewCard({ step, title, desc, icon, gradientFrom, gradientTo }: SkewCardProps) {
  return (
    <div className="group relative w-full h-[400px] transition-all duration-500">
      {/* Skewed gradient panels */}
      <span
        className="absolute top-0 left-[20%] w-1/2 h-full rounded-[16px] transform skew-x-[15deg] transition-all duration-500 group-hover:skew-x-0 group-hover:left-[5%] group-hover:w-[90%]"
        style={{
          background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
        }}
      />
      <span
        className="absolute top-0 left-[20%] w-1/2 h-full rounded-[16px] transform skew-x-[15deg] blur-[30px] transition-all duration-500 group-hover:skew-x-0 group-hover:left-[5%] group-hover:w-[90%]"
        style={{
          background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
        }}
      />

      {/* Animated blurs */}
      <span className="pointer-events-none absolute inset-0 z-10">
        <span className="absolute top-0 left-0 w-0 h-0 rounded-lg opacity-0 bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-all duration-100 group-hover:top-[-20px] group-hover:left-[20px] group-hover:w-[80px] group-hover:h-[80px] group-hover:opacity-100" />
        <span className="absolute bottom-0 right-0 w-0 h-0 rounded-lg opacity-0 bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-all duration-500 group-hover:bottom-[-20px] group-hover:right-[20px] group-hover:w-[80px] group-hover:h-[80px] group-hover:opacity-100" />
      </span>

      {/* Content */}
      <div className="relative z-20 h-full p-[40px] bg-[#161616]/90 backdrop-blur-[10px] border border-[#333333] group-hover:border-transparent rounded-[16px] text-white transition-all duration-500 group-hover:left-[-10px] group-hover:p-[50px_40px] flex flex-col justify-between">
        <div>
          <div className="absolute top-6 right-6 text-4xl font-bold text-[#FCFCFC]/10 select-none group-hover:text-white/20 transition-colors">
            {step}
          </div>
          <div className="w-12 h-12 rounded-[12px] bg-[#D7FF67]/15 flex items-center justify-center text-[#D7FF67] mb-6 group-hover:bg-white/20 group-hover:text-white transition-colors">
            {icon}
          </div>
          <h3 className="text-xl font-bold text-[#FCFCFC] mb-3">{title}</h3>
          <p className="text-[#888888] leading-relaxed text-sm group-hover:text-white/90 transition-colors">{desc}</p>
        </div>
      </div>
    </div>
  );
}
