import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400", "500"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400"] });

export const metadata: Metadata = {
  title: "MIZU — Where the Seasons Remember",
  description: "A browser-based exploration of a fictional Japanese valley. No missions. No score. Only the world.",
};

export const viewport: Viewport = { themeColor: "#0a0c12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const o=new MutationObserver((m)=>{for(let i=0;i<m.length;i++){const r=m[i];if(r.type==='attributes'&&r.attributeName&&r.attributeName.indexOf('bis_')===0){r.target.removeAttribute(r.attributeName);}}});o.observe(document.documentElement,{attributes:true,subtree:true});}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
