"use client";

import React from "react";
import { HeroSection } from "@/components/guest/HeroSection";
import ServicesSection from "@/components/guest/ServicesSection";
import { AboutSection } from "@/components/guest/AboutSection";
import ProductCatalog from "@/components/guest/ProductCatalog";

export default function Home() {
  return (
    <>
      <HeroSection />
      <div style={{ background: '#000814' }}>
        <ServicesSection />
        <ProductCatalog />
        <AboutSection />
      </div>
    </>
  );
}
