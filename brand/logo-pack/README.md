# VoxTree Logo Pack

Source: the live website logo — `components/voxtree-logo.tsx` (VoxMark / VoxWordmark)
in the VoxTree repo. The mark is a tree trunk whose canopy is three concentric
soundwave arcs with a top dot (foliage + voice).

Brand colors (from `app/globals.css`):
- Ink: #0A0E1F (dark background)
- Paper: #F4ECDB (cream)
- Lamp: #F4B860 (gold)

## svg/ — vector masters (use these first, they scale to anything)
- Mark only: paper-on-ink, lamp-on-ink, ink-on-paper, + transparent in all 3 colors
- Wordmark (mark + "VoxTree"): paper-on-ink, lamp-on-ink, ink-on-paper

## png/ — ready-to-upload forms
- Profile pictures: profile-{paper-on-ink, lamp-on-ink, ink-on-paper}-{1080,800,400}.png
- Transparent marks: mark-{paper,lamp,ink}-transparent-{1024,512}.png (overlays, watermarks)
- Wordmarks: wordmark-{paper-on-ink, lamp-on-ink, ink-on-paper}-1920.png
- Banners: banner-x-1500x500, banner-linkedin-1584x396, banner-facebook-cover-1640x924, banner-youtube-2560x1440
- Story cover: story-cover-1080x1920.png
- App/favicon icons: icon-lamp-on-ink-{512,180,64,32}.png

## Also in this folder
- voxtree-logo-color-artwork-original.webp — the separate colorful green/gold
  tree artwork generated Oct 28, 2026. NOT the website logo; alternate art only.

Note: there is also a legacy BrandLogo component (sparkles icon) in the repo.
The soundwave tree above is what the live site layout uses.
