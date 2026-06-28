"use client";

import React from "react";
import { HeroSection } from "@/components/guest/HeroSection";
import { CoreTechSection } from "@/components/guest/CoreTechSection";
import { WorkflowSection } from "@/components/guest/WorkflowSection";
import { ShowcaseSection } from "@/components/guest/ShowcaseSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <div style={{ background: '#000814' }}>
        <CoreTechSection />
        <WorkflowSection />
        <ShowcaseSection />
      </div>
    </>
  );
}
