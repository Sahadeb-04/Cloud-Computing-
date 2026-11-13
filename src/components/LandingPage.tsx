import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CloudUpload,
  FolderHeart,
  HardDrive,
  Lock,
  Moon,
  Play,
  Share2,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Button } from './ui';
import heroArchiveImg from '../assets/images/hero_memora_archive_1794587581744.jpg';
import alpineDawnImg from '../assets/images/showcase_alpine_dawn_1794587580989.jpg';
import coastalCliffImg from '../assets/images/showcase_coastal_cliff_1794587581407.jpg';
import architectureLightImg from '../assets/images/showcase_architecture_light_1794587582982.jpg';

interface LandingPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onGetStarted: () => void;
  onLogin: () => void;
}

const FAQS = [
  {
    q: 'How does MEMORA keep my photos and videos private?',
    a: 'Every uploaded file is stored inside isolated private object storage rather than public buckets. Viewing or downloading media requires a short-lived, cryptographically signed URL issued exclusively to the owner or an authorized share recipient.',
  },
  {
    q: 'What file formats and sizes are supported?',
    a: 'MEMORA supports JPG, JPEG, PNG, WEBP, and GIF images alongside MP4, MOV, and WEBM videos up to 500 MB per file. Original files are preserved intact while fast thumbnails are generated automatically.',
  },
  {
    q: 'Can I control whether someone can download a shared photo or album?',
    a: 'Yes. Every share link lets you toggle download permission on or off, add an optional password, set an automatic expiration window, or revoke access immediately at any time.',
  },
  {
    q: 'What happens when I reach my 5 GB free storage limit?',
    a: 'Your existing memories stay completely safe and accessible. New uploads pause with a clear notification until you free up space in Trash or upgrade to Plus (100 GB) or Pro (1 TB).',
  },
  {
    q: 'Can I recover files I accidentally deleted?',
    a: 'Deleting a photo or video moves it to Trash first, preserving the original file and metadata until you choose to restore it or permanently empty Trash.',
  },
];

export function LandingPage({
  theme,
  onToggleTheme,
  onGetStarted,
  onLogin,
}: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [previewTab, setPreviewTab] = useState<'photos' | 'albums' | 'videos'>('photos');

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 dark:bg-[#0B0D12] dark:text-slate-100">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0D12]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            MEMORA
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <a href="#security" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Security
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="shrink-0">
            <Button onClick={onGetStarted} size="md">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split Section */}
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-20 lg:pt-24 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4">
                Every memory. One safe place.
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08]"
                style={{ fontSize: 'clamp(2.35rem, 4.2vw, 3.75rem)', textWrap: 'balance' }}
              >
                Your memories deserve a safe home.
              </h1>
              <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl">
                Upload full-resolution photos and videos to private cloud storage, organize effortless albums by date, stream video smoothly, and share moments with granular permissions.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={onGetStarted}>
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onLogin}>
                  Login
                </Button>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                <span>5 GB free encrypted storage</span>
                <span aria-hidden="true">·</span>
                <span>Original quality preserved</span>
                <span aria-hidden="true">·</span>
                <span>Private signed access</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                <img
                  src={heroArchiveImg}
                  alt="MEMORA private photography archive studio desk"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Dashboard Preview Section */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131722] overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  MEMORA Workspace Preview
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  2.42 GB of 5 GB used · 148 photos · 19 videos
                </span>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                {(['photos', 'albums', 'videos'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPreviewTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                      previewTab === tab
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E2433] dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {previewTab === 'photos' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    {
                      src: alpineDawnImg,
                      title: 'Bernese Oberland Dawn.jpg',
                      meta: '4032 × 3024 · 6.4 MB · Nov 12',
                    },
                    {
                      src: coastalCliffImg,
                      title: 'Ionian Limestone Coast.jpg',
                      meta: '4032 × 3024 · 5.8 MB · Nov 08',
                    },
                    {
                      src: architectureLightImg,
                      title: 'Travertine Atrium Study.jpg',
                      meta: '3840 × 2880 · 4.9 MB · Oct 29',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E121B]"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-slate-200 dark:bg-slate-800">
                        <img
                          src={item.src}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {item.meta}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {previewTab === 'albums' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { src: alpineDawnImg, title: 'Autumn Alpine Expedition', meta: '42 items · Private' },
                    { src: coastalCliffImg, title: 'Mediterranean Aerials', meta: '28 items · Link shared' },
                    { src: architectureLightImg, title: 'Architectural Light', meta: '19 items · Private' },
                  ].map((album) => (
                    <div
                      key={album.title}
                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E121B]"
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={album.src}
                          alt={album.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {album.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {album.meta}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {previewTab === 'videos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    {
                      src: coastalCliffImg,
                      title: 'Coastal_Drone_4K_Master.mp4',
                      meta: '02:18 · 184 MB · HTTP Range Streaming',
                    },
                    {
                      src: alpineDawnImg,
                      title: 'Morning_Ridge_Timelapse.mov',
                      meta: '00:46 · 72 MB · Original Preserved',
                    },
                  ].map((video) => (
                    <div
                      key={video.title}
                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E121B]"
                    >
                      <div className="relative aspect-video overflow-hidden">
                        <img
                          src={video.src}
                          alt={video.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-center justify-center">
                          <span className="h-12 w-12 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-md">
                            <Play className="h-5 w-5 ml-0.5" />
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {video.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {video.meta}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features Asymmetric Bento Grid */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-20 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Built for permanence and everyday speed.
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              Every detail of MEMORA is designed to keep your full-resolution library organized, verifiable, and ready to stream.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8">
              <CloudUpload className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Direct multi-file cloud uploads with live progress
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
                Drag and drop JPG, PNG, WEBP, GIF, MP4, MOV, or WEBM files directly from your device. Track upload progress file by file, cancel in-flight transfers cleanly, retry interrupted batches, and rely on automatic server-side quota enforcement.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8">
              <FolderHeart className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Albums, Favorites, and Trash
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Curate shared albums with custom cover images, star your favorite captures, bulk-select across dates, and recover deleted files safely from Trash.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8">
              <Share2 className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Permission-controlled links
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Share individual photos, videos, or albums with view-only enforcement, optional downloads, password locks, expiration timers, and instant link revocation.
              </p>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8">
              <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Original preservation with optimized previews & range streaming
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
                Photos keep their exact original bytes and dimensions while generating crisp WebP thumbnails for instant gallery scrolling. Videos stream via HTTP 206 byte-range requests so scrubbing is immediate even on large recordings.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How MEMORA works
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: '01. Create your private vault',
                desc: 'Register with email verification or sign in with Google. Every new account starts with 5 GB of private cloud storage.',
              },
              {
                num: '02. Upload & process automatically',
                desc: 'Drop photos and videos from desktop or mobile. MEMORA validates formats, extracts dimensions and duration, and builds gallery thumbnails.',
              },
              {
                num: '03. Organize, stream & share safely',
                desc: 'Group memories into albums, browse masonry or timeline grids, and issue time-limited or password-protected share links.',
              },
            ].map((step) => (
              <div key={step.num} className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {step.num}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Plans */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Simple, transparent storage plans
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              Start with 5 GB free. Upgrade seamlessly whenever your archive grows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'FREE',
                audience: 'For personal everyday memories',
                price: '$0',
                cadence: 'forever',
                storage: '5 GB private storage',
                features: [
                  'Original photo & video uploads',
                  'Albums, favorites & trash recovery',
                  'View-only & expiring share links',
                ],
                featured: false,
              },
              {
                name: 'PLUS',
                audience: 'For growing family archives',
                price: '$4.99',
                cadence: '/ month',
                storage: '100 GB private storage',
                features: [
                  'Everything in Free',
                  'Password-protected shared albums',
                  '500 MB per-file upload limit',
                ],
                featured: true,
              },
              {
                name: 'PRO',
                audience: 'For photographers & 4K creators',
                price: '$12.99',
                cadence: '/ month',
                storage: '1 TB private storage',
                features: [
                  'Everything in Plus',
                  'Priority media thumbnail processing',
                  'Full-resolution archive management',
                ],
                featured: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col justify-between border ${
                  plan.featured
                    ? 'border-blue-600 bg-white dark:bg-[#131722] shadow-sm'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131722]'
                }`}
              >
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-sm font-bold tracking-wide text-blue-600 dark:text-blue-400">
                      {plan.name}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {plan.storage}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {plan.audience}
                  </p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {plan.price}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {plan.cadence}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-6">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant={plan.featured ? 'primary' : 'outline'}
                  className="mt-8 w-full"
                  onClick={onGetStarted}
                >
                  Choose {plan.name}
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Security & Privacy */}
        <section id="security" className="mx-auto max-w-7xl px-6 py-20 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <ShieldCheck className="h-7 w-7 text-blue-600 dark:text-blue-400 mb-4" />
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Private by architecture, not just by policy.
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                Your photos and videos are never placed in open public directories. Every request is authenticated, rate-limited, and verified against your user ID.
              </p>
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  icon: Lock,
                  title: 'Signed temporary access',
                  body: 'Media thumbnails and original streams use HMAC-signed URLs with automatic expiration.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Strict user isolation',
                  body: 'Every database query scopes media, albums, and favorites strictly to the authenticated owner.',
                },
                {
                  icon: HardDrive,
                  title: 'Server-side validation',
                  body: 'MIME types, file extensions, upload rate limits, and storage quotas are verified before saving.',
                },
                {
                  icon: Share2,
                  title: 'Revocable share links',
                  body: 'Disable downloads, add passwords, set expiry windows, or revoke any shared link immediately.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6"
                  >
                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-3" />
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-4xl px-6 py-20 border-t border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-10">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="font-display text-base font-semibold text-slate-900 dark:text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform duration-150 shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0D12]">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-display font-bold text-slate-900 dark:text-white">
              MEMORA
            </span>
            <span aria-hidden="true">·</span>
            <span>Every memory. One safe place.</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
