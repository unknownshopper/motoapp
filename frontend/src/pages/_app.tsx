import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Layout from '../components/Layout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const publicPaths = ['/login'];

  useEffect(() => {
    const enforce = (url?: string) => {
      const path = url ?? router.asPath;
      const isPublic = publicPaths.some((p) => path.startsWith(p));
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!isPublic && !token) {
        router.replace('/login');
        return false;
      }
      if (isPublic && token) {
        router.replace('/vehicles');
        return false;
      }
      return true;
    };
    enforce();
    setReady(true);
    const handleStart = (url: string) => { enforce(url); };
    router.events.on('routeChangeStart', handleStart);
    return () => {
      router.events.off('routeChangeStart', handleStart);
    };
  }, [router]);

  useEffect(() => {
    api.getCurrentRole();
  }, []);

  if (!ready) return null;
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
