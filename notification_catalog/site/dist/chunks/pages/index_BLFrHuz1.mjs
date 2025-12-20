import { d as createComponent, i as createAstro, g as renderComponent, h as renderTemplate } from '../astro_B9tGE1JN.mjs';
import 'kleur/colors';
import 'clsx';
import { p as paths, g as generateRouteData, $ as $$Page } from './404_Blwuvgqv.mjs';

const $$Astro = createAstro();
async function getStaticPaths() {
  return paths;
}
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const { Content, headings } = await Astro2.props.entry.render();
  const route = generateRouteData({ props: { ...Astro2.props, headings }, url: Astro2.url });
  return renderTemplate`${renderComponent($$result, "Page", $$Page, { ...route }, { "default": async ($$result2) => renderTemplate`${renderComponent($$result2, "Content", Content, {})}` })}`;
}, "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/index.astro", void 0);

const $$file = "/Users/carlstratton/Documents/totl-despia2/totl-despia/notification_catalog/site/node_modules/@astrojs/starlight/index.astro";
const $$url = undefined;

export { $$Index as default, $$file as file, getStaticPaths, $$url as url };
