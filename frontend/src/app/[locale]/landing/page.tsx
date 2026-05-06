"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import {
  Box,
  Building2,
  ClipboardList,
  Container,
  FileText,
  Globe2,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Ship,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const b2bProducts = [
  {
    id: "PRD-001",
    name: "Premium Robusta Coffee Beans (Grade 1)",
    category: "Agricultural",
    hsCode: "0901.11.10",
    moq: "1x20ft Container (19.2 MT)",
    packing: "60kg/Jute Bag",
    image: "☕",
  },
  {
    id: "PRD-002",
    name: "Cashew Nuts W320",
    category: "Agricultural",
    hsCode: "0801.32.00",
    moq: "1x20ft Container (15.8 MT)",
    packing: "22.68kg/Vacuum bag/Carton",
    image: "🥜",
  },
  {
    id: "PRD-003",
    name: "Wooden Dining Furniture Set",
    category: "Furniture",
    hsCode: "9403.60.90",
    moq: "1x40HQ Container (68 CBM)",
    packing: "Flat pack/Carton Box",
    image: "🪑",
  },
];

const stats = [
  {
    label: "Active shipment lanes",
    value: "42",
    note: "Asia → EU/US",
    icon: Ship,
  },
  {
    label: "Average lead time",
    value: "19 days",
    note: "Factory to port",
    icon: Container,
  },
  {
    label: "Document accuracy",
    value: "99.2%",
    note: "CI, PL, CO",
    icon: FileText,
  },
  {
    label: "On-time departure",
    value: "96.4%",
    note: "ETA/ETD verified",
    icon: MapPin,
  },
];

const portalPillars = [
  {
    title: "Unified order visibility",
    description: "Track PO → production → stuffing → customs with one shared timeline.",
    icon: Building2,
  },
  {
    title: "Audit-ready documents",
    description: "Instant access to CI, PL, CO, and insurance files with version control.",
    icon: FileText,
  },
  {
    title: "Payments that reconcile",
    description: "L/C, T/T milestones auto-matched to shipment and ledger events.",
    icon: ShieldCheck,
  },
];

const partnerLogos = [
  "Nordic Foods",
  "Hanover Imports",
  "Maritime AG",
  "Orchard & Co.",
  "Blue Harbor",
];

const experienceSteps = [
  {
    title: "Sourcing intake",
    description: "Standardized RFQ briefs, HS verification, and MOQ alignment in one flow.",
    icon: ClipboardList,
  },
  {
    title: "Production & QA",
    description: "Milestone approvals, SGS checks, and packaging compliance tracked live.",
    icon: Box,
  },
  {
    title: "Shipment & docs",
    description: "ETD/ETA alerts, vessel updates, and document readiness in sync.",
    icon: Ship,
  },
  {
    title: "Settlement",
    description: "L/C, T/T, and invoice reconciliations with audit-ready trails.",
    icon: Building2,
  },
];


export default function B2BBuyerPortal() {

  const theme = {
    "--portal-bg": "#f6f2ea",
    "--portal-fg": "#121417",
    "--portal-muted": "#6b6f76",
    "--portal-accent": "#0f4c3a",
    "--portal-accent-strong": "#0b3b2d",
    "--portal-gold": "#c9a25a",
    "--portal-surface": "rgba(255, 255, 255, 0.8)",
    "--portal-stroke": "rgba(15, 76, 58, 0.16)",
    "--portal-shadow": "0 30px 60px -35px rgba(18, 20, 23, 0.55)",
    "--portal-display": '"Playfair Display", "Cormorant Garamond", serif',
    fontFamily: '"Sora", "Space Grotesk", sans-serif',
  } as React.CSSProperties;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-(--portal-bg) text-(--portal-fg)"
      style={theme}
    >
      <BackgroundTexture />
      <Navbar />
      <main className="relative z-10 pt-24">
        <HeroTracking />
        <BrandStrip />
        <StatsStrip />
        <ExperienceFlow />
        <WholesaleCatalog />
        <WhyPartnerWithUs />
        <TrustSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

function BackgroundTexture() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-28 right-[-8%] h-104 w-104 rounded-full bg-(--portal-gold) opacity-20 blur-[120px]" />
      <div className="absolute top-[28%] -left-20 h-120 w-120 rounded-full bg-(--portal-accent) opacity-20 blur-[130px]" />
      <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(rgba(15,76,58,0.6)_1px,transparent_1px)] bg-size-[26px_26px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(246,242,234,0.9)_0%,rgba(246,242,234,0.1)_48%,rgba(246,242,234,0.85)_100%)]" />
    </div>
  );
}

function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-(--portal-stroke) bg-white/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-3 text-lg font-semibold tracking-tight text-(--portal-fg)">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-(--portal-accent) text-white shadow-lg shadow-emerald-900/30">
            <Globe2 className="h-5 w-5" />
          </span>
          VinaExport Concierge
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm font-medium text-(--portal-muted)">
          <a href="#catalog" className="transition-colors hover:text-(--portal-accent)">Product Suite</a>
          <a href="#portal" className="transition-colors hover:text-(--portal-accent)">Buyer Portal</a>
          <a href="#trust" className="transition-colors hover:text-(--portal-accent)">Compliance</a>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-(--portal-stroke) bg-transparent text-(--portal-fg) hover:bg-white"
            asChild
          >
            <Link href="/auth/login">Partner Portal Login</Link>
          </Button>
          <Button
            className="hidden sm:flex bg-(--portal-accent) text-white hover:bg-(--portal-accent-strong)"
            asChild
          >
            <Link href="/auth/register">Request Access</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroTracking() {
  return (
    <section id="tracking" className="px-6 lg:px-12 pt-10 pb-20">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <div
            className="inline-flex w-fit items-center gap-2 rounded-full border border-(--portal-stroke) bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-(--portal-muted)"
          >
            <span className="h-2 w-2 rounded-full bg-(--portal-gold)" />
            Premium buyer command center
          </div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl leading-[1.05]"
            style={{ fontFamily: "var(--portal-display)" }}
          >
            Trade with total certainty. Every shipment, every document, every milestone.
          </h1>
          <p className="text-base md:text-lg text-(--portal-muted) max-w-xl">
            A concierge-grade buyer portal that makes cross-border sourcing feel effortless. Track ETD/ETA, validate
            documents, and request quotes from a single, polished workspace.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button className="bg-(--portal-accent) text-white hover:bg-(--portal-accent-strong)" asChild>
              <Link href="/auth/register">Start a managed onboarding</Link>
            </Button>
            <Button variant="outline" className="border-(--portal-stroke) bg-transparent" asChild>
              <Link href="#catalog">Explore products</Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-(--portal-muted)">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-(--portal-accent)" />
              SOC-style audit trails
            </span>
            <span className="inline-flex items-center gap-2">
              <Box className="h-4 w-4 text-(--portal-accent)" />
              Incoterms-aware pricing
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-(--portal-accent)" />
              Live vessel milestones
            </span>
          </div>
        </div>

        <div
          className="rounded-4xl border border-(--portal-stroke) bg-(--portal-surface) p-6 shadow-(--portal-shadow) backdrop-blur"
        >
          <div className="flex items-center justify-between text-sm font-semibold text-(--portal-fg)">
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-(--portal-accent)" />
              Live Shipment Studio
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700">Connected</span>
          </div>

          <div className="mt-6 rounded-2xl border border-(--portal-stroke) bg-white px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-(--portal-muted)">
              <Search className="h-4 w-4" />
              <input
                type="text"
                placeholder="BL / Container / Sales Contract ID"
                className="w-full bg-transparent text-sm text-(--portal-fg) outline-none placeholder:text-(--portal-muted)"
              />
              <Button className="h-9 px-4 bg-(--portal-accent) text-white hover:bg-(--portal-accent-strong)">
                Track
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-(--portal-stroke) bg-white p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-(--portal-muted)">Current lane</div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold">SGN → Hamburg</div>
                  <div className="text-xs text-(--portal-muted)">Vessel: CMA CGM Titan</div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">ETD +2d</span>
              </div>
            </div>
            <div className="rounded-2xl border border-(--portal-stroke) bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--portal-muted)">Documents ready</span>
                <span className="font-semibold text-(--portal-fg)">5 / 6</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-amber-100">
                <div className="h-2 w-[82%] rounded-full bg-(--portal-gold)" />
              </div>
              <div className="mt-2 text-xs text-(--portal-muted)">CO pending legalization</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-(--portal-stroke) bg-white px-4 py-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-(--portal-muted)">Quote request</div>
              <div className="mt-1 font-semibold text-(--portal-fg)">Cashew W320, 1x20ft</div>
            </div>
            <Button variant="outline" className="border-(--portal-stroke) text-(--portal-fg)">
              Review
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="px-6 lg:px-12 pb-16">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-(--portal-stroke) bg-white/80 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 text-sm text-(--portal-muted)">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-(--portal-accent)">
                <item.icon className="h-4 w-4" />
              </span>
              {item.label}
            </div>
            <div className="mt-4 text-2xl font-semibold text-(--portal-fg)">{item.value}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-(--portal-muted)">{item.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandStrip() {
  return (
    <section className="px-6 lg:px-12 pb-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-3xl border border-(--portal-stroke) bg-white/80 px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="text-xs uppercase tracking-[0.3em] text-(--portal-muted)">
          Trusted by global trading desks
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-(--portal-muted)">
          {partnerLogos.map((brand) => (
            <span key={brand} className="font-semibold text-(--portal-fg)">
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExperienceFlow() {
  return (
    <section id="flow" className="px-6 lg:px-12 pb-20">
      <div className="mx-auto grid max-w-7xl gap-10 rounded-4xl border border-(--portal-stroke) bg-white/80 p-8 md:p-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="text-xs uppercase tracking-[0.3em] text-(--portal-muted)">Concierge flow</div>
          <h2 className="text-3xl md:text-4xl" style={{ fontFamily: "var(--portal-display)" }}>
            A white-glove operating rhythm from sourcing to settlement.
          </h2>
          <p className="text-(--portal-muted)">
            Your buyer team gets a guided workflow that keeps vendors, logistics, and finance aligned without chasing
            spreadsheets.
          </p>
          <div className="rounded-2xl border border-(--portal-stroke) bg-white p-4 text-sm text-(--portal-muted)">
            <span className="font-semibold text-(--portal-fg)">Service level:</span> 24h document turnaround, 2-hour
            exception alerts, dedicated trade concierge.
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {experienceSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-(--portal-stroke) bg-white/95 p-5 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-(--portal-accent)">
                <step.icon className="h-5 w-5" />
              </span>
              <div className="mt-4 text-base font-semibold text-(--portal-fg)">{step.title}</div>
              <div className="mt-2 text-sm text-(--portal-muted)">{step.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WholesaleCatalog() {
  return (
    <section id="catalog" className="px-6 lg:px-12 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-(--portal-muted)">
              Curated for enterprise buyers
            </div>
            <h2
              className="mt-3 text-3xl md:text-4xl"
              style={{ fontFamily: "var(--portal-display)" }}
            >
              Premium export catalog with compliance-ready packaging details.
            </h2>
            <p className="mt-4 text-(--portal-muted) max-w-2xl">
              Every SKU is validated with HS code, MOQ, and packing standards so your procurement team can act fast.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-(--portal-stroke) text-(--portal-fg) hover:bg-white"
          >
            Download company profile
          </Button>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {b2bProducts.map((product) => (
            <div
              key={product.id}
              className="group rounded-3xl border border-(--portal-stroke) bg-white/90 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-(--portal-muted)">
                <span>{product.category}</span>
                <span>HS {product.hsCode}</span>
              </div>
              <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-4xl">
                {product.image}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-(--portal-fg)">{product.name}</h3>
              <div className="mt-4 space-y-3 text-sm text-(--portal-muted)">
                <div className="flex items-start gap-3">
                  <Container className="mt-0.5 h-4 w-4 text-(--portal-accent)" />
                  <span>
                    <span className="font-semibold text-(--portal-fg)">MOQ:</span> {product.moq}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-4 w-4 text-(--portal-accent)" />
                  <span>
                    <span className="font-semibold text-(--portal-fg)">Packing:</span> {product.packing}
                  </span>
                </div>
              </div>
              <Button className="mt-6 w-full bg-(--portal-fg) text-white hover:bg-black">
                <ClipboardList className="h-4 w-4" />
                Request RFQ
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyPartnerWithUs() {
  return (
    <section id="portal" className="px-6 lg:px-12 py-20">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-(--portal-muted)">Buyer experience</div>
            <h2 className="mt-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--portal-display)" }}>
              A portal that feels like a private trading desk.
            </h2>
            <p className="mt-4 text-(--portal-muted)">
              Give your procurement team the same clarity as your internal ops. Everything is synchronized across
              inventory, logistics, finance, and documentation.
            </p>
          </div>
          <div className="grid gap-4">
            {portalPillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-(--portal-stroke) bg-white/85 p-5 shadow-sm"
              >
                <div className="flex items-center gap-3 text-(--portal-fg)">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-(--portal-accent)">
                    <pillar.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{pillar.title}</div>
                    <div className="text-sm text-(--portal-muted)">{pillar.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-4xl border border-(--portal-stroke) bg-white/90 p-6 shadow-(--portal-shadow)">
          <div className="flex items-center justify-between border-b border-(--portal-stroke) pb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-(--portal-muted)">Live workspace</div>
              <div className="mt-1 text-lg font-semibold">Buyer cockpit preview</div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700">Verified</span>
          </div>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-(--portal-stroke) bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-(--portal-fg)">PO-2026-EU-042</div>
                  <div className="text-xs text-(--portal-muted)">FOB Ho Chi Minh • 2x40HQ</div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">In production</span>
              </div>
              <div className="mt-3 text-xs text-(--portal-muted)">Next gate: Vendor stuffing inspection</div>
            </div>
            <div className="rounded-2xl border border-(--portal-stroke) bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-(--portal-fg)">PO-2026-EU-039</div>
                  <div className="text-xs text-(--portal-muted)">CIF Hamburg • 1x20ft</div>
                </div>
                <Button variant="link" className="h-auto p-0 text-(--portal-accent)">
                  <FileText className="mr-1 h-3 w-3" />
                  Get Docs
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-(--portal-muted)">
                <span>Vessel ETA</span>
                <span className="font-semibold text-(--portal-fg)">May 08, 2026</span>
              </div>
            </div>
            <div className="rounded-2xl border border-(--portal-stroke) bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--portal-muted)">Payment milestones</span>
                <span className="font-semibold text-(--portal-fg)">3 / 4 cleared</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-emerald-100">
                <div className="h-2 w-[78%] rounded-full bg-(--portal-accent)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section id="trust" className="px-6 lg:px-12 py-20">
      <div className="mx-auto max-w-7xl rounded-4xl border border-(--portal-stroke) bg-white/90 p-8 md:p-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-(--portal-muted)">Compliance layer</div>
            <h2 className="mt-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--portal-display)" }}>
              Built for auditors, lenders, and long-term partners.
            </h2>
            <p className="mt-4 text-(--portal-muted)">
              Every shipment event is logged, every document version is preserved, and every payment is reconciled
              against its commercial terms.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                "Versioned document vault",
                "Supplier ESG dossier",
                "Incoterms & LC auto-checks",
                "Role-based approvals",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-(--portal-muted)">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-(--portal-accent)">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-(--portal-stroke) bg-emerald-50/70 p-6">
            <div className="flex items-center justify-between text-sm font-semibold text-(--portal-fg)">
              <span>Audit snapshot</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-(--portal-muted)">Last 24h</span>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-(--portal-muted)">Document verifications</span>
                <span className="font-semibold">48</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--portal-muted)">Discrepancies flagged</span>
                <span className="font-semibold">2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--portal-muted)">Ready for financing</span>
                <span className="font-semibold">8 shipments</span>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-white p-4 text-xs text-(--portal-muted)">
              All audit events are exportable for insurers, lenders, and government compliance.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="cta" className="px-6 lg:px-12 pb-24">
      <div
        className="mx-auto max-w-7xl rounded-[36px] bg-(--portal-accent) p-10 text-white shadow-(--portal-shadow) md:p-14"
      >
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-white/70">Premium onboarding</div>
            <h2 className="mt-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--portal-display)" }}>
              Upgrade the way your team sources globally.
            </h2>
            <p className="mt-4 text-white/75">
              Share one workspace with your supplier, forwarder, and finance desk. We set it up, you stay in control.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button className="bg-white text-(--portal-accent) hover:bg-white/90" asChild>
              <Link href="/auth/register">Book a private demo</Link>
            </Button>
            <Button variant="outline" className="border-white/40 text-white hover:bg-white/10" asChild>
              <Link href="/auth/login">Access partner portal</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-(--portal-stroke) bg-white/80 px-6 py-10 text-sm text-(--portal-muted)">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>© 2026 VinaExport Trading Co., Ltd.</div>
        <div className="flex flex-wrap gap-6">
          <a href="#" className="transition-colors hover:text-(--portal-fg)">Terms of Trade</a>
          <a href="#" className="transition-colors hover:text-(--portal-fg)">Privacy Policy</a>
          <a href="#" className="transition-colors hover:text-(--portal-fg)">Contact Sales</a>
        </div>
      </div>
    </footer>
  );
}
