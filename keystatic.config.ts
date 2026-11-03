import { config, collection, singleton, fields } from '@keystatic/core';
import { r2Image } from './src/keystatic/r2-image';

/**
 * The CMS lives at /keystatic.
 *  - In `npm run dev` it edits files on disk directly.
 *  - On the live site it commits to GitHub; Cloudflare rebuilds on each commit.
 *  - `npm run cms:github-setup` runs it locally in GitHub mode once, to create
 *    the GitHub App (Keystatic writes the credentials to .env).
 * Images go to R2 (see src/keystatic/r2-image.tsx), never into Git.
 */
const useLocalStorage = import.meta.env.DEV && import.meta.env.PUBLIC_KEYSTATIC_STORAGE !== 'github';

export default config({
  storage: useLocalStorage
    ? { kind: 'local' }
    : { kind: 'github', repo: { owner: 'InnoRD01', name: 'Interweave' } },

  ui: {
    brand: { name: 'Interweave' },
    navigation: {
      Work: ['projects'],
      Pages: ['studio', 'contact', 'settings'],
    },
  },

  collections: {
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { contentField: 'narrative' },
      entryLayout: 'content',
      columns: ['title', 'yearStart', 'status'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),

        // Listing & ordering
        featured: fields.checkbox({ label: 'Show on home page', defaultValue: false }),
        order: fields.integer({
          label: 'Sort order',
          description: 'Lower numbers appear first. Leave empty to sort by year.',
        }),

        // Facts
        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Built', value: 'built' },
            { label: 'Under construction', value: 'construction' },
            { label: 'In design', value: 'design' },
            { label: 'Unbuilt / competition', value: 'unbuilt' },
          ],
          defaultValue: 'built',
        }),
        typology: fields.select({
          label: 'Typology',
          options: [
            { label: 'Residential', value: 'residential' },
            { label: 'Hospitality', value: 'hospitality' },
            { label: 'Institutional', value: 'institutional' },
            { label: 'Cultural', value: 'cultural' },
            { label: 'Commercial', value: 'commercial' },
            { label: 'Interiors', value: 'interiors' },
            { label: 'Landscape & urban', value: 'landscape' },
          ],
          defaultValue: 'residential',
        }),
        yearStart: fields.integer({ label: 'Year started' }),
        yearEnd: fields.integer({ label: 'Year completed', description: 'Leave empty if ongoing.' }),
        location: fields.text({ label: 'Location', description: 'e.g. Tadong, Gangtok, Sikkim' }),
        coordinates: fields.object(
          {
            lat: fields.number({ label: 'Latitude' }),
            lng: fields.number({ label: 'Longitude' }),
          },
          { label: 'Map position', description: 'Right-click the site in Google Maps to copy coordinates.' },
        ),
        client: fields.text({ label: 'Client' }),
        siteArea: fields.text({ label: 'Site area', description: 'e.g. 420 sqm' }),
        builtArea: fields.text({ label: 'Built-up area', description: 'e.g. 260 sqm' }),
        team: fields.text({ label: 'Design team', multiline: true }),
        collaborators: fields.array(
          fields.object({
            role: fields.text({ label: 'Role', description: 'e.g. Structure, Contractor, Photography' }),
            name: fields.text({ label: 'Name' }),
          }),
          { label: 'Collaborators', itemLabel: (p) => `${p.fields.role.value}: ${p.fields.name.value}` },
        ),

        // Site & climate: the Himalayan context, shown as its own block
        site: fields.object(
          {
            altitude: fields.text({ label: 'Altitude', description: 'e.g. 1,650 m' }),
            rainfall: fields.text({ label: 'Annual rainfall', description: 'e.g. 3,500 mm' }),
            temperature: fields.text({ label: 'Temperature range', description: 'e.g. 4–26 °C' }),
            terrain: fields.text({ label: 'Terrain / slope', description: 'e.g. 35° north-east slope' }),
            notes: fields.text({ label: 'Site notes', multiline: true }),
          },
          { label: 'Site & climate' },
        ),

        // Imagery
        cover: r2Image({ label: 'Cover image', folder: 'projects', required: true }),
        coverAlt: fields.text({ label: 'Cover image description (alt text)' }),
        summary: fields.text({
          label: 'One-line summary',
          description: 'Used in listings and for search engines.',
          multiline: true,
        }),
        gallery: fields.array(
          fields.object({
            image: r2Image({ label: 'Image', folder: 'projects', required: true }),
            alt: fields.text({ label: 'Description (alt text)' }),
            caption: fields.text({ label: 'Caption' }),
            credit: fields.text({ label: 'Photo credit' }),
            layout: fields.select({
              label: 'Layout',
              options: [
                { label: 'Full width', value: 'full' },
                { label: 'Half (pairs with the next half image)', value: 'half' },
                { label: 'Inset (narrow, centred)', value: 'inset' },
              ],
              defaultValue: 'full',
            }),
          }),
          {
            label: 'Gallery',
            itemLabel: (p) => p.fields.caption.value || p.fields.image.value?.key || 'Image',
          },
        ),

        narrative: fields.markdoc({ label: 'Narrative', options: { image: false } }),
      },
    }),
  },

  singletons: {
    settings: singleton({
      label: 'Site settings',
      path: 'src/content/settings',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Studio name', defaultValue: 'Interweave' }),
        tagline: fields.text({ label: 'Tagline' }),
        description: fields.text({ label: 'Search engine description', multiline: true }),
        instagram: fields.url({ label: 'Instagram URL' }),
      },
    }),
    studio: singleton({
      label: 'Studio',
      path: 'src/content/studio',
      format: { data: 'json' },
      schema: {
        statement: fields.text({ label: 'Statement', multiline: true }),
        approach: fields.text({ label: 'Approach', description: 'Separate paragraphs with a blank line.', multiline: true }),
        domains: fields.array(fields.text({ label: 'Domain' }), {
          label: 'Areas of work',
          itemLabel: (p) => p.value,
        }),
        people: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            role: fields.text({ label: 'Role' }),
            bio: fields.text({ label: 'Short bio', multiline: true }),
            portrait: r2Image({ label: 'Portrait', folder: 'people' }),
          }),
          { label: 'People', itemLabel: (p) => p.fields.name.value },
        ),
      },
    }),
    contact: singleton({
      label: 'Contact',
      path: 'src/content/contact',
      format: { data: 'json' },
      schema: {
        address: fields.text({ label: 'Address', multiline: true }),
        email: fields.text({ label: 'Email' }),
        phone: fields.text({ label: 'Phone' }),
        mapsUrl: fields.url({ label: 'Google Maps link' }),
        enquiries: fields.text({ label: 'Note for new enquiries', multiline: true }),
        careers: fields.text({ label: 'Careers / internships note', multiline: true }),
      },
    }),
  },
});
