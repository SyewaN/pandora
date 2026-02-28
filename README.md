# Obruk IoT Tarım Platformu

ESP32 sensörlerinden (TDS, sıcaklık, nem) veri toplayan, backend üzerinden saklayan ve Python LSTM servisi ile kısa vadeli tahmin/anomali analizi yapan production-oriented proje.

## Mimari

- `backend/`: Node.js + Express API (`:3000`)
- `ai/`: Flask + TensorFlow/Keras LSTM (`:5000`)
- `data/`: Sensör ölçüm dosyası (`measurements.json`)
- `logs/`: Uygulama ve PM2 logları
- `scripts/`: Kurulum, deploy, backup scriptleri

## Kurulum

1. Ortam değişkenlerini oluştur:
```bash
cp .env.example .env
```
2. İlk kurulum scriptini çalıştır:
```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```
3. Servisleri başlat:
```bash
pm2 start ecosystem.config.js --env development
```

## Geliştirme

- Backend: `npm run dev`
- AI: `python3 ai/app.py`
- Model eğitimi: `python3 ai/train.py`

## API Endpoints

### Backend (`http://localhost:3000`)

- `GET /api/health` -> Backend + AI sağlık kontrolü
- `POST /api/data` -> Veri doğrula, kaydet, AI tahmini üret
- `GET /api/data?page=1&limit=20` -> Sayfalı tüm veriler
- `GET /api/data/latest` -> Son ölçüm
- `GET /api/data/stats` -> Ortalama, min, max istatistikleri

### AI (`http://localhost:5000`)

- `GET /health` -> AI servis sağlık kontrolü
- `GET /model/info` -> Model modu ve yapı bilgisi
- `POST /predict` -> Son 10 ölçümle 3 adım tahmin + anomali skoru

## Veri Formatı

```json
{
  "tds": 450,
  "temperature": 25,
  "moisture": 350,
  "timestamp": "2026-02-27T10:00:00Z"
}
```

## Güvenlik

- `helmet` ile HTTP güvenlik başlıkları
- `express-rate-limit` ile 100 istek / 15 dakika / IP
- CORS kontrolü
- Girdi validasyonu
- Winston tabanlı hata/işlem loglama

## Üretim Notları

- PM2 bellek limitleri: backend `500MB`, AI `1GB`
- Graceful shutdown etkin
- Model dosyaları `ai/model/` altında saklanır
- Yedekleme scripti `data/measurements.json` dosyasını zaman damgasıyla kopyalar
