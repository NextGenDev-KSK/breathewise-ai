/** Static indoor-air guidance. General good practice; no quantified health claims. */
export interface GuideSection {
  id: string;
  title: string;
  intro: string;
  points: string[];
}

export const INDOOR_GUIDE: GuideSection[] = [
  {
    id: "ventilation",
    title: "Ventilation",
    intro: "Fresh air dilutes indoor pollutants, but on high-pollution hours it also brings outdoor particles inside.",
    points: [
      "When outdoor air is comparatively clean, cross-ventilate by opening windows on opposite sides for a while.",
      "When outdoor pollution is high, avoid opening windows unnecessarily; air out briefly at the forecast's cleaner hours.",
      "Always ventilate when using gas, kerosene or any fuel-burning appliance, and when the room feels stuffy or humid.",
      "BreatheWise cannot see indoor conditions. An indoor PM2.5 or CO₂ monitor gives a direct reading.",
    ],
  },
  {
    id: "cooking",
    title: "Cooking smoke",
    intro: "Cooking, especially frying and grilling, is one of the largest indoor sources of fine particles.",
    points: [
      "Use a kitchen exhaust (chimney) that vents outdoors, not a recirculating one, and run it during and after cooking.",
      "Without an exhaust, open the kitchen window or use a fan blowing outward, and keep the kitchen door closed.",
      "Use lids, avoid overheating oil until it smokes, and clean greasy burners.",
      "Solid fuels (wood, coal, dung) produce heavy smoke; use cleaner fuels where available.",
    ],
  },
  {
    id: "dust",
    title: "Dust management",
    intro: "Settled dust is easily stirred back into the air.",
    points: [
      "Damp-dust surfaces with a slightly wet cloth instead of dry dusting or feather dusters.",
      "Wet-mop hard floors rather than sweeping with a broom.",
      "If you vacuum, a vacuum with a HEPA filter keeps fine dust from blowing back out.",
      "Leave outdoor shoes at the door and wash curtains and soft furnishings regularly.",
    ],
  },
  {
    id: "sources",
    title: "Indoor pollution sources",
    intro: "Removing a source is more effective than cleaning the air afterwards.",
    points: [
      "Keep the home smoke-free: no indoor smoking.",
      "Reduce incense, dhoop, candles and mosquito coils; consider nets or plug-in repellents.",
      "Avoid burning anything indoors, including waste, and avoid running generators indoors or near windows.",
      "Choose fragrance-free cleaning products and ventilate when using sprays, solvents or paints.",
    ],
  },
  {
    id: "purification",
    title: "Air purifiers",
    intro: "A correctly sized purifier with a true HEPA filter can reduce indoor particle levels in a closed room.",
    points: [
      "Look for a true HEPA filter and a stated Clean Air Delivery Rate (CADR) suited to your room size.",
      "Run it in the room you use most, often the bedroom, with doors and windows closed.",
      "Replace or clean filters on the manufacturer's schedule; a clogged filter cleans far less air.",
      "Do not use ozone-generating 'ionizer' or 'ozone' air cleaners; ozone is itself a lung irritant.",
      "Houseplants are not a substitute for filtration at realistic home scale.",
      "Purifiers reduce particles but do little for gases like NO₂ or CO; source control and ventilation still matter.",
    ],
  },
];
