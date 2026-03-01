# Pandora IoT - YunoHost App Package

Bu klasor, projeyi YunoHost uzerine uygulama olarak kurmak icin gereken paket dosyalarini icerir.

## Icerik

- `manifest.toml`: YunoHost app metadata + install sorulari
- `scripts/`: install / upgrade / remove / backup / restore / change_url
- `conf/nginx.conf`: reverse proxy (backend + `/ai/` rotasi)
- `conf/*.service`: backend ve ai systemd servisleri

## Kurulum

YunoHost sunucusunda:

```bash
yunohost app install /path/to/repo/yunohost_app
```

Kurulum sirasinda:

- `domain` ve `path` secilir
- `repo_url` (varsayilan: `https://github.com/SyewaN/pandora_ynh.git`)
- `repo_branch` (varsayilan: `main`)

YunoHost'ta uygulama paket reposu URL'sinin `_ynh` ile bitmesi beklenir.
Ornek: `https://domain.tld/path/to/pandora_ynh`

## Notlar

- Backend icin `express`, `cors`, `helmet` bagimliliklari kurulum scriptinde ayrica yuklenir.
- AI servisi demo modda Flask + Flask-CORS ile calisir.
- Uygulama iki ayri systemd servisi ile ayaga kalkar:
  - `<app>-backend`
  - `<app>-ai`
