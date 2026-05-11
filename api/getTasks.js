import { ConvexHttpClient } from "convex/browser";

export default async function handler(req, res) {
  const convexUrl = process.env.VITE_CONVEX_URL || "https://aware-leopard-887.convex.cloud";
  const client = new ConvexHttpClient(convexUrl);

  try {
    // Using string reference to avoid import issues
    const tasks = await client.query("tasks:getTasksLight");
    
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Vercel Tasks Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
}
