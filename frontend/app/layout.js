import "./globals.css";

export const metadata = {
  title: "Collaborative Team Hub",
  description: "A FredoCloud intern assignment implementation"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
