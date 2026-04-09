import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "CareerForge AI — From Student to Hired, Intelligently",
  description:
    "AI-powered career intelligence platform that analyzes your GitHub, LeetCode, and resume to find gaps, generate personalized roadmaps, and coach you through mock interviews — all autonomously.",
  openGraph: {
    title: "CareerForge AI — From Student to Hired, Intelligently",
    description:
      "AI-powered career intelligence platform for college students. Gap analysis, adaptive roadmaps, mock interviews, and job matching.",
    type: "website",
  },
};

export default function Page() {
  return <LandingPage />;
}
