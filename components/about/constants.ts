import { FeaturesGridListType, ValueItemProps } from "./types";

export const featuresGridList: FeaturesGridListType[] = [
  {
    title: "Wide Product Selection",
    description:
      "Explore a variety of trending products, everyday essentials, and unique collections all in one place.",
    iconPaths: ["M6 7h12l1 14H5L6 7z", "M9 7a3 3 0 016 0", "M8 12h8M8 16h5"],
  },
  {
    title: "Customer Focused",
    description:
      "We prioritize customer satisfaction with smooth navigation, secure checkout, and responsive support.",
    iconPaths: [
      "M12 12a4 4 0 100-8 4 4 0 000 8z",
      "M4 21a8 8 0 0116 0",
      "M17.5 11.5c.9-.9 2.5-.3 2.5 1 0 1.5-2.5 3-2.5 3s-2.5-1.5-2.5-3c0-1.3 1.6-1.9 2.5-1z",
    ],
  },
  {
    title: "Safe & Secure",
    description:
      "Your personal information and payments are protected with modern security technologies and trusted systems.",
    iconPaths: [
      "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
      "M9 12h6v5H9z",
      "M10 12V9a2 2 0 114 0v3",
    ],
  },
];

export const valuesSectionList: ValueItemProps[] = [
  {
    emoji: "🎯",
    title: "Quality",
    description:
      "We carefully select products that meet high standards of reliability, value, and performance.",
    bgColor: "indigo",
  },
  {
    emoji: "🤝",
    title: "Trust",
    description:
      "We believe shopping should feel safe, transparent, and dependable for every customer.",
    bgColor: "purple",
  },
  {
    emoji: "💡",
    title: "Innovation",
    description:
      "We continuously improve our platform to provide a faster, smarter, and more enjoyable shopping experience.",
    bgColor: "indigo",
  },
  {
    emoji: "🌟",
    title: "Simplicity",
    description:
      "We design every part of DreamShop to make discovering and purchasing products easy and stress-free.",
    bgColor: "purple",
  },
];
