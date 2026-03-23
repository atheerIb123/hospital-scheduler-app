"use client";

import { useMode, AppMode } from "@/components/ModeProvider";
import { useRouter } from "next/navigation";

export default function Home() {
  const { setMode } = useMode();
  const router = useRouter();

  const handleSelect = (mode: AppMode) => {
    setMode(mode);
    router.push("/employees");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-slate-800">ברוכים הבאים למתזמן המשמרות</h1>
        <p className="text-slate-500 text-lg">אנא בחר את התצוגה המבוקשת כדי להמשיך</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4">
        <button
          onClick={() => handleSelect("doctors")}
          className="flex flex-col items-center justify-center p-10 bg-white rounded-3xl shadow-sm border-2 border-slate-100 hover:border-blue-500 hover:shadow-lg hover:bg-blue-50 transition-all group"
        >
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a2.25 2.25 0 00-2.25-2.25h-3a2.25 2.25 0 00-2.25 2.25V21m4.125-18h-2.25a2.25 2.25 0 00-2.25 2.25V6m0 0h6m-6 0h-3v14h3m6-14v14m0-14h3v14m-3-14h-3M6 6H3v14h3m12-14V6a2.25 2.25 0 00-2.25-2.25m0 0V3a2.25 2.25 0 00-2.25-2.25h-2.25m0 0h2.25M6 6v14m12 0v-14" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-800">רופאים</span>
          <p className="text-slate-500 text-sm mt-3 text-center">ניהול משמרות לסגל הרפואי</p>
        </button>

        <button
          onClick={() => handleSelect("nursing")}
          className="flex flex-col items-center justify-center p-10 bg-white rounded-3xl shadow-sm border-2 border-slate-100 hover:border-emerald-500 hover:shadow-lg hover:bg-emerald-50 transition-all group"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-800">סיעוד</span>
          <p className="text-slate-500 text-sm mt-3 text-center">ניהול משמרות לסגל הסיעודי</p>
        </button>

        <button
          onClick={() => handleSelect("cleaning")}
          className="flex flex-col items-center justify-center p-10 bg-white rounded-3xl shadow-sm border-2 border-slate-100 hover:border-amber-500 hover:shadow-lg hover:bg-amber-50 transition-all group"
        >
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.879-3.879a1.5 1.5 0 00-2.12-2.12l-3.879 3.879a15.995 15.995 0 00-4.648 4.764z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-800">ניקיון</span>
          <p className="text-slate-500 text-sm mt-3 text-center">ניהול משמרות לצוות הניקיון</p>
        </button>
      </div>
    </div>
  );
}
