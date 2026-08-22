import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Store, Zap, Globe, UserCircle, LogOut, LayoutDashboard, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

// Extend JSX IntrinsicElements to include spline-viewer
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': any;
    }
  }
}

const Home: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

  // No Spline viewer needed anymore
  useEffect(() => {
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col relative font-sans overflow-hidden">
      
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent)] z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto w-full mt-4 bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center">
             <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">EaaS</span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
           <a href="#platform" className="hover:text-slate-900 transition-colors">Platform</a>
           <a href="#solutions" className="hover:text-slate-900 transition-colors">Solutions</a>
           <a href="#resources" className="hover:text-slate-900 transition-colors">Resources</a>
           <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
        </div>

        <div className="flex items-center space-x-4">
          {!isLoading && user ? (
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="flex items-center space-x-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <div className="h-4 w-px bg-slate-300"></div>
              <div className="flex items-center space-x-2 group cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 group-hover:border-slate-400 transition-all">
                   <UserCircle className="w-6 h-6 text-slate-500" />
                </div>
                <button onClick={logout} className="ml-2 text-slate-400 hover:text-rose-500 transition-colors" title="Log out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors px-4 py-2 border border-transparent hover:bg-slate-100 rounded-full">
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-sm font-semibold bg-[#111827] text-white px-6 py-2.5 rounded-full hover:bg-slate-800 transition-all shadow-[0_4px_14px_0_rgb(17,24,39,0.39)] hover:shadow-[0_6px_20px_rgba(17,24,39,0.23)] hover:-translate-y-0.5"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left: Typography & CTA */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-left max-w-xl z-20"
        >
          <h1 className="text-5xl md:text-6xl lg:text-[76px] font-extrabold tracking-[-0.04em] text-[#0F172A] leading-[1.05] mb-6">
            The global commerce <br className="hidden lg:block"/> platform, built for you.
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-medium mb-10 leading-relaxed max-w-lg">
            Launch, manage, and scale your online business globally with the unified commerce ecosystem designed for modern brands.
          </p>

          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Link
              to="/signup"
              className="w-full sm:w-auto text-base font-semibold bg-[#2563EB] text-white px-8 py-4 rounded-full transition-all shadow-[0_8px_20px_-6px_rgba(37,99,235,0.6)] hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.7)] hover:-translate-y-1 flex items-center justify-center group"
            >
              Start free trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/signup"
              className="w-full sm:w-auto text-base font-semibold text-slate-700 bg-white border border-slate-200 px-8 py-4 rounded-full transition-all hover:bg-slate-50 hover:border-slate-300 shadow-sm flex items-center justify-center group"
            >
              Contact sales
            </Link>
          </div>
          
          <div className="mt-12 flex flex-col sm:flex-row items-center sm:space-x-8 opacity-70 grayscale transition-opacity hover:opacity-100">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4 sm:mb-0">Trusted by modern teams</p>
            <div className="flex flex-wrap justify-center gap-6 sm:space-x-8 sm:gap-0 items-center text-slate-700">
              <span className="font-serif italic text-xl font-bold">Lumina</span>
              <span className="font-sans text-xl font-black tracking-tighter">VERTEX</span>
              <span className="font-mono text-lg font-bold tracking-widest">NEXUS</span>
              <span className="font-sans text-xl font-medium tracking-tight">AcmeCorp</span>
            </div>
          </div>
        </motion.div>

        {/* Right: Floating UI Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="relative w-full h-[500px] lg:h-[600px] z-10 hidden md:flex items-center justify-center perspective-[1000px]"
        >
          {/* Main Dashboard Card */}
          <div className="absolute w-[120%] lg:w-[130%] h-[420px] bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] p-8 rotate-y-[-10deg] rotate-x-[5deg] rotate-z-[-2deg] hover:rotate-0 transition-transform duration-700 ease-out hover:scale-[1.02]">
             {/* Fake UI Header */}
             <div className="flex items-center space-x-4 mb-8 border-b border-slate-200/50 pb-5">
               <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-inner"></div>
               <div className="space-y-2">
                 <div className="w-32 h-4 bg-slate-200 rounded-full"></div>
                 <div className="w-20 h-3 bg-slate-100 rounded-full"></div>
               </div>
             </div>
             
             {/* Fake UI Content */}
             <div className="space-y-6">
               <div className="flex justify-between items-end">
                 <div className="space-y-3">
                   <div className="w-28 h-3 bg-slate-300 rounded-full"></div>
                   <div className="w-56 h-10 bg-slate-800 rounded-xl"></div>
                 </div>
                 <div className="w-28 h-12 bg-indigo-50 border border-indigo-100 rounded-xl"></div>
               </div>
               
               <div className="grid grid-cols-3 gap-5 mt-8">
                 <div className="h-36 bg-gradient-to-b from-slate-50 to-white rounded-[1.5rem] border border-slate-100 p-5 shadow-sm">
                   <div className="w-12 h-12 bg-blue-100 rounded-full mb-5"></div>
                   <div className="w-24 h-2 bg-slate-200 rounded-full mb-3"></div>
                   <div className="w-16 h-2 bg-slate-200 rounded-full"></div>
                 </div>
                 <div className="h-36 bg-gradient-to-b from-slate-50 to-white rounded-[1.5rem] border border-slate-100 p-5 shadow-sm">
                   <div className="w-12 h-12 bg-emerald-100 rounded-full mb-5"></div>
                   <div className="w-28 h-2 bg-slate-200 rounded-full mb-3"></div>
                   <div className="w-12 h-2 bg-slate-200 rounded-full"></div>
                 </div>
                 <div className="h-36 bg-gradient-to-b from-slate-50 to-white rounded-[1.5rem] border border-slate-100 p-5 shadow-sm">
                   <div className="w-12 h-12 bg-rose-100 rounded-full mb-5"></div>
                   <div className="w-20 h-2 bg-slate-200 rounded-full mb-3"></div>
                   <div className="w-24 h-2 bg-slate-200 rounded-full"></div>
                 </div>
               </div>
             </div>
          </div>
          
          {/* Floating Element: New Order Notification */}
          <motion.div 
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            className="absolute -right-8 top-1/4 bg-white/90 backdrop-blur-md p-5 rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 flex items-center space-x-4 z-20"
          >
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-xl">+$</div>
            <div>
              <div className="w-24 h-3 bg-slate-300 rounded-full mb-2"></div>
              <div className="w-16 h-2 bg-slate-200 rounded-full"></div>
            </div>
          </motion.div>

          {/* Floating Element: Customer Joined */}
          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
            className="absolute -left-12 bottom-1/4 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center space-x-4 z-20"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="w-20 h-2 bg-slate-300 rounded-full mb-2"></div>
              <div className="w-12 h-2 bg-slate-200 rounded-full"></div>
            </div>
          </motion.div>

          {/* Fallback gradient orb behind UI */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        </motion.div>
      </main>

      {/* Feature Bento Grid (Below the fold) */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">Everything you need to sell</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">One unified platform providing all the tools to build, manage, and scale your ecommerce empire.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Big Bento Item 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="md:col-span-8 p-10 rounded-[32px] bg-white border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all overflow-hidden relative group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 group-hover:bg-blue-500/10 transition-colors"></div>
            <Store className="w-12 h-12 text-blue-600 mb-6 bg-blue-50 p-3 rounded-2xl" />
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Customizable Storefronts</h3>
            <p className="text-slate-600 leading-relaxed text-lg max-w-md">Create a beautiful, unique online store with our powerful Next.js integrated themes. Drag, drop, and publish in minutes.</p>
          </motion.div>

          {/* Small Bento Item 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="md:col-span-4 p-10 rounded-[32px] bg-slate-900 border border-slate-800 text-white shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
          >
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/30 rounded-full blur-3xl -z-10"></div>
            <Zap className="w-12 h-12 text-blue-400 mb-6 bg-blue-500/10 p-3 rounded-2xl" />
            <h3 className="text-2xl font-bold mb-3">Lightning Fast</h3>
            <p className="text-slate-400 leading-relaxed">Built on Go and React, ensuring your customers never wait for a page to load.</p>
          </motion.div>

          {/* Wide Bento Item */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="md:col-span-12 p-10 md:p-12 rounded-[32px] bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all flex flex-col md:flex-row items-center justify-between"
          >
            <div className="max-w-xl">
              <div className="flex items-center space-x-3 mb-6">
                <Globe className="w-8 h-8 text-indigo-600" />
                <span className="text-sm font-bold uppercase tracking-wider text-indigo-600">Omnichannel</span>
              </div>
              <h3 className="text-3xl font-bold text-slate-900 mb-4">Sell Anywhere</h3>
              <p className="text-slate-600 leading-relaxed text-lg">One platform with all the omnichannel features you need to start, run, and grow your business across web, mobile, and in-person POS.</p>
            </div>
            <div className="mt-8 md:mt-0 w-full md:w-1/3 flex justify-end">
              <Link to="/signup" className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                <ChevronRight className="w-8 h-8" />
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
      
    </div>
  );
};

export default Home;
