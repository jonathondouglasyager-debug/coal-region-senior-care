const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function slugify(str) {
  return str.toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categorySlug(category) {
  const map = {
    assisted_living: "assisted-living",
    home_health: "home-health",
    hospice: "hospice",
    nursing_home: "nursing-homes",
    senior_center: "senior-centers",
    support_services: "support-services"
  };
  return map[category] || category;
}

function categoryLabel(category) {
  const map = {
    assisted_living: "Assisted Living",
    home_health: "Home Health",
    hospice: "Hospice",
    nursing_home: "Nursing Homes",
    senior_center: "Senior Centers",
    support_services: "Support Services"
  };
  return map[category] || category;
}

function categorySchemaType(category) {
  const map = {
    assisted_living: "LocalBusiness",
    home_health: "LocalBusiness",
    hospice: "LocalBusiness",
    nursing_home: "NursingHome",
    senior_center: "LocalBusiness",
    support_services: "LocalBusiness"
  };
  return map[category] || "LocalBusiness";
}

module.exports = function() {
  const dataDir = path.join(__dirname, "../../data");

  // Read premium config (empty for now)
  let premiumData = {};
  const premiumPath = path.join(__dirname, "premium.json");
  if (fs.existsSync(premiumPath)) {
    const premiumConfig = JSON.parse(fs.readFileSync(premiumPath, "utf8"));
    premiumData = premiumConfig.businesses || {};
  }

  // Read main business data
  const csvPath = path.join(dataDir, "senior-care-businesses.csv");
  const mainCsv = fs.readFileSync(csvPath, "utf8");
  const mainRecords = parse(mainCsv, { columns: true, skip_empty_lines: true, trim: true });

  // Filter and clean
  const businesses = mainRecords
    .filter(b => {
      if (b.business_status && b.business_status !== "OPERATIONAL") return false;
      return true;
    })
    .map(b => {
      const slug = slugify(b.name);
      const catSlug = categorySlug(b.category);
      const url = `/${catSlug}/${slug}/`;
      const prem = premiumData[slug] || null;

      return {
        name: b.name,
        slug,
        category: b.category,
        categorySlug: catSlug,
        categoryLabel: categoryLabel(b.category),
        schemaType: categorySchemaType(b.category),
        address: b.address,
        city: b.city,
        citySlug: slugify(b.city),
        zip: b.zip,
        phone: b.phone,
        email: b.email || "",
        website: b.website || "",
        lat: b.lat || "",
        lng: b.lng || "",
        google_rating: b.google_rating ? parseFloat(b.google_rating) : null,
        google_review_count: b.google_review_count ? parseInt(b.google_review_count) : 0,
        google_maps_url: b.google_maps_url || "",
        url,

        // Premium status
        premium: !!prem,
        tier: b.tier || "1",

        // Premium content fields (null/empty for free listings)
        premiumTagline: prem ? (prem.tagline || null) : null,
        premiumDescription: prem ? (prem.description || null) : null,
        premiumPhotos: prem ? (prem.photos || []) : [],
        premiumHours: prem ? (prem.hours || null) : null,
        premiumServices: prem ? (prem.services || null) : null,
        premiumTestimonials: prem ? (prem.testimonials || []) : [],
        premiumBadges: prem ? (prem.badges || []) : [],
        premiumDirector: prem ? (prem.director || null) : null,
        premiumSocial: prem ? (prem.social || null) : null,

        // Services list
        services: buildServices(b)
      };
    })
    .sort((a, b) => {
      // Premium listings first, then alphabetical
      if (a.premium && !b.premium) return -1;
      if (!a.premium && b.premium) return 1;
      return a.name.localeCompare(b.name);
    });

  // Group by category
  const byCategory = {};
  for (const b of businesses) {
    if (!byCategory[b.categorySlug]) {
      byCategory[b.categorySlug] = {
        slug: b.categorySlug,
        label: b.categoryLabel,
        items: []
      };
    }
    byCategory[b.categorySlug].items.push(b);
  }

  // Group by city
  const byCity = {};
  for (const b of businesses) {
    const city = b.city;
    if (!byCity[city]) {
      byCity[city] = {
        name: city,
        slug: b.citySlug,
        items: []
      };
    }
    byCity[city].items.push(b);
  }

  // Top cities sorted by number of businesses
  const cities = Object.values(byCity)
    .sort((a, b) => b.items.length - a.items.length);

  return {
    all: businesses,
    byCategory,
    byCity,
    cities,
    categories: Object.values(byCategory)
  };
};

function buildServices(business) {
  const services = [];
  const cat = business.category;

  if (cat === "assisted_living") {
    services.push("Assisted Living");
    services.push("Personal Care");
    services.push("Memory Care");
  } else if (cat === "home_health") {
    services.push("Home Health Care");
    services.push("Skilled Nursing Visits");
    services.push("Home Care Aides");
  } else if (cat === "hospice") {
    services.push("Hospice Care");
    services.push("Palliative Care");
    services.push("Bereavement Support");
  } else if (cat === "nursing_home") {
    services.push("Skilled Nursing");
    services.push("Long-Term Care");
    services.push("Rehabilitation");
  } else if (cat === "senior_center") {
    services.push("Social Programs");
    services.push("Meals & Nutrition");
    services.push("Activities & Events");
  } else if (cat === "support_services") {
    services.push("Senior Support Services");
  }

  return services;
}
