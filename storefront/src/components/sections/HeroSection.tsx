import Link from 'next/link';

export default function HeroSection({ settings, subdomain }: { settings: any, subdomain: string }) {
  const title = settings.title || `${subdomain} Collection`;
  const subtitle = settings.subtitle || "Discover the new standard in minimalist design and everyday essentials.";
  const buttonText = settings.buttonText || "Shop Now";
  const buttonLink = settings.buttonLink || "#products";
  const imageUrl = settings.imageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2000&q=80";

  return (
    <section className="relative h-[60vh] min-h-[500px] w-full bg-theme-bg overflow-hidden">
      <img 
        src={imageUrl} 
        alt="Hero Cover" 
        className="absolute inset-0 w-full h-full object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/50 to-transparent"></div>
      <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4 capitalize">
          {title}
        </h2>
        <p className="text-lg md:text-xl text-zinc-200 max-w-2xl mb-8">
          {subtitle}
        </p>
        <Link href={buttonLink} className="bg-theme-primary text-theme-bg px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity">
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
