import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ShoppingBag, Loader2, MailCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const Signup: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post('http://localhost:8080/api/auth/signup', {
        email,
        password,
      });
      toast.success('Account created! Please check your email.');
      setStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post('http://localhost:8080/api/auth/verify', {
        email,
        code: otp,
      });
      await refreshUser();
      toast.success('Email verified successfully!');
      navigate('/dashboard'); // We will create this later
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Verification failed. Invalid OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 -z-10 w-full h-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#e0e7ff_100%)]"></div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2">
            <ShoppingBag className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">eaas</span>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-slate-900">
            {step === 1 ? 'Start your free trial' : 'Check your email'}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {step === 1 ? (
              <>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary hover:text-blue-700">
                  Log in
                </Link>
              </>
            ) : (
              `We've sent a 6-digit code to ${email}`
            )}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl py-8 px-10 shadow-2xl rounded-2xl border border-slate-100 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
                onSubmit={handleSignup}
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <div className="mt-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 py-2.5 px-4 text-slate-900 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="mt-2">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 py-2.5 px-4 text-slate-900 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm transition-all"
                      placeholder="At least 8 characters"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full justify-center items-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-all disabled:opacity-70"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Create account'
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
                onSubmit={handleVerify}
              >
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    <MailCheck className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-slate-700 text-center">
                    Verification Code
                  </label>
                  <div className="mt-2 flex justify-center">
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="block w-full max-w-[200px] text-center tracking-widest text-2xl font-bold rounded-lg border border-slate-300 py-3 px-4 text-slate-900 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary sm:text-sm transition-all"
                      placeholder="000000"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="flex w-full justify-center items-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all disabled:opacity-70"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Verify & Continue'
                    )}
                  </button>
                </div>
                
                <p className="text-center text-xs text-slate-500 mt-4">
                  Didn't receive it? <button type="button" className="text-primary font-semibold" onClick={() => setStep(1)}>Go back</button> and try again.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Signup;
