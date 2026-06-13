import { useEffect } from "react";
import type { RouteMeta } from "../lib/routeMeta";
import { routeUrl } from "../lib/routeMeta";

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let element = document.querySelector(`meta[${attr}="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(href: string) {
  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }

  element.href = href;
}

type PageMetaProps = Pick<RouteMeta, "path" | "title" | "description">;

export default function PageMeta({ path, title, description }: PageMetaProps) {
  useEffect(() => {
    const url = routeUrl(path);

    document.title = title;
    setMeta("description", description);
    setCanonical(url);
    setMeta("og:url", url, true);
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
  }, [path, title, description]);

  return null;
}
