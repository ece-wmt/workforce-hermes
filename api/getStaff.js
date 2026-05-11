import { ConvexHttpClient } from "convex/browser";

export default async function handler(req, res) {
  const convexUrl = process.env.VITE_CONVEX_URL || "https://aware-leopard-887.convex.cloud";
  const client = new ConvexHttpClient(convexUrl);

  try {
    // Using string reference to avoid import issues
    const staff = await client.query("staff:getStaff");
    
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(staff);
  } catch (error) {
    console.error("Vercel Staff Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
}
