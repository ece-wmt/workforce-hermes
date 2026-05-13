import { ConvexHttpClient } from "convex/browser";

export default async function handler(req, res) {
  const convexUrl = process.env.VITE_CONVEX_URL || "https://aware-leopard-887.convex.cloud";
  const client = new ConvexHttpClient(convexUrl);

  const email = req.query.email;
  if (!email) {
    res.status(400).json({ error: "Missing email parameter" });
    return;
  }

  try {
    const notifications = await client.query("notifications:getNotifications", { email });
    
    // Short cache — notifications are somewhat time-sensitive but don't need realtime
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Vercel Notifications Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
}
