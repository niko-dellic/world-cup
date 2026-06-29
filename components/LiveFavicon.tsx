"use client";

import { useEffect } from "react";

const LIVE_ICON_BY_SIZE: Record<string, string> = {
  any: "/live-favicon/favicon.ico",
  "16x16": "/live-favicon/favicon-16x16.png",
  "32x32": "/live-favicon/favicon-32x32.png",
};

const DEFAULT_ICON_KEY = "defaultHref";
const DEFAULT_TYPE_KEY = "defaultType";

type LiveFaviconProps = {
  active: boolean;
};

export function LiveFavicon({ active }: LiveFaviconProps) {
  useEffect(() => {
    const iconLinks = getIconLinks();

    iconLinks.forEach((link) => {
      link.dataset[DEFAULT_ICON_KEY] ??= link.href;
      link.dataset[DEFAULT_TYPE_KEY] ??= link.type;

      if (active) {
        const size = link.getAttribute("sizes") ?? "any";
        const nextHref = LIVE_ICON_BY_SIZE[size] ?? LIVE_ICON_BY_SIZE.any;

        link.href = nextHref;
        link.type = nextHref.endsWith(".png") ? "image/png" : "image/x-icon";
      } else {
        restoreIconLink(link);
      }
    });

    return () => {
      iconLinks.forEach(restoreIconLink);
    };
  }, [active]);

  return null;
}

function getIconLinks() {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')).filter(
    (link) => link.rel !== "apple-touch-icon",
  );
}

function restoreIconLink(link: HTMLLinkElement) {
  const defaultHref = link.dataset[DEFAULT_ICON_KEY];
  if (defaultHref) {
    link.href = defaultHref;
  }

  const defaultType = link.dataset[DEFAULT_TYPE_KEY];
  if (defaultType !== undefined) {
    link.type = defaultType;
  }
}
