import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400", "500"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400"] });

export const viewport: Viewport = { themeColor: "#0a0c12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <title>MIZU — Where the Seasons Remember</title>
        <meta name="description" content="A browser-based exploration of a fictional Japanese valley. No missions. No score. Only the world." />
      </head>
      <body suppressHydrationWarning>
        <Script
          id="ext-hydration-clean"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{new MutationObserver(m=>{for(let i=0;i<m.length;i++){const r=m[i];if(r.type==='attributes'&&r.attributeName&&r.attributeName.startsWith('bis_')){r.target.removeAttribute(r.attributeName);}}}).observe(document.documentElement,{attributes:true,subtree:true});const c=console.error;console.error=function(...a){const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)||'').join(' ');if(s.includes('bis_skin_checked')||s.includes('bis_register'))return;c.apply(console,a);};}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
