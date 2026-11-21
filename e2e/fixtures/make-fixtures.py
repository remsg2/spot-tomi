"""Génère les photos de test de l'étape 5 (python3 e2e/fixtures/make-fixtures.py, Pillow requis).

- sticker-gps.jpg : photo « d'appareil » 4032 × 3024, orientation 6 (à faire
  pivoter de 90°), EXIF complet (marque, modèle, date de prise avec décalage
  horaire, GPS d'Ushuaïa avec altitude), profil ICC et paquet XMP qui répète
  la position. C'est le fichier « réel avec GPS » des critères de l'étape 5.
- sticker-sans-gps.jpg : 1600 × 1200, sans aucune métadonnée (ni GPS, ni date).
- webp-avec-metadonnees.webp / webp-propre.webp : WebP réels (libwebp), le
  premier avec EXIF (GPS), XMP et ICC, le second sans rien : tests du
  contrôle des chunks RIFF (supabase/functions/_shared/webp-metadata.test.ts).
Les images sont des dégradés avec des formes : pas de bruit, fichiers légers.
"""
from pathlib import Path

from PIL import Image, ImageCms, ImageDraw
from PIL.ExifTags import GPS, IFD, Base

HERE = Path(__file__).resolve().parent


def scene(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / height
        draw.line([(0, y), (width, y)], fill=(int(120 + 80 * t), int(150 + 40 * t), int(190 - 60 * t)))
    # Poteau, sol et « sticker » vert.
    draw.rectangle([0, int(height * 0.75), width, height], fill=(110, 120, 112))
    draw.rectangle([int(width * 0.42), 0, int(width * 0.56), height], fill=(85, 92, 99))
    s = int(min(width, height) * 0.22)
    x, y = int(width * 0.4), int(height * 0.3)
    draw.rectangle([x, y, x + s, y + s], fill=(93, 176, 67))
    draw.polygon([(x, y + s), (x, int(y + s * 0.95)), (x + s, int(y + s * 0.64)), (x + s, y + s)], fill=(17, 17, 17))
    return image


def dms(value: float):
    value = abs(value)
    degrees = int(value)
    minutes_full = (value - degrees) * 60
    minutes = int(minutes_full)
    seconds = round((minutes_full - minutes) * 60, 4)
    return (degrees, minutes, seconds)


def gps_photo() -> None:
    lat, lng = -54.8019, -68.3030
    exif = Image.Exif()
    exif[Base.Make] = "SpotTomiTest"
    exif[Base.Model] = "Appareil de test"
    exif[Base.Orientation] = 6
    exif[Base.DateTime] = "2026:03:15 09:00:00"
    exif_ifd = exif.get_ifd(IFD.Exif)
    exif_ifd[Base.DateTimeOriginal] = "2026:03:14 16:42:00"
    exif_ifd[Base.OffsetTimeOriginal] = "-03:00"
    exif_ifd[Base.DateTimeDigitized] = "2026:03:14 16:42:00"
    gps = exif.get_ifd(IFD.GPSInfo)
    gps[GPS.GPSVersionID] = b"\x02\x02\x00\x00"
    gps[GPS.GPSLatitudeRef] = "S"
    gps[GPS.GPSLatitude] = dms(lat)
    gps[GPS.GPSLongitudeRef] = "W"
    gps[GPS.GPSLongitude] = dms(lng)
    gps[GPS.GPSAltitudeRef] = b"\x00"
    gps[GPS.GPSAltitude] = 25.5
    gps[GPS.GPSDateStamp] = "2026:03:14"

    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    xmp = (
        '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" '
        'exif:GPSLatitude="54,48.114S" exif:GPSLongitude="68,18.18W" '
        'xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="SpotTomiTest"/>'
        "</rdf:RDF></x:xmpmeta><?xpacket end=\"w\"?>"
    ).encode()

    scene(4032, 3024).save(
        HERE / "sticker-gps.jpg", "JPEG", quality=82, exif=exif.tobytes(), icc_profile=icc, xmp=xmp
    )


def plain_photo() -> None:
    scene(1600, 1200).save(HERE / "sticker-sans-gps.jpg", "JPEG", quality=82)


def webp_files() -> None:
    with Image.open(HERE / "sticker-gps.jpg") as source:
        exif = source.getexif().tobytes()
        icc = source.info["icc_profile"]
        xmp = source.info["xmp"]
        small = source.resize((320, 240))
    small.save(HERE / "webp-avec-metadonnees.webp", "WEBP", quality=70, exif=exif, icc_profile=icc, xmp=xmp)
    small.save(HERE / "webp-propre.webp", "WEBP", quality=70)


if __name__ == "__main__":
    gps_photo()
    plain_photo()
    webp_files()
    for name in ("sticker-gps.jpg", "sticker-sans-gps.jpg", "webp-avec-metadonnees.webp", "webp-propre.webp"):
        print(name, (HERE / name).stat().st_size, "octets")
