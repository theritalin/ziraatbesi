# Ürün Gereksinim Belgesi (PRD) - Çiftlik Yönetim Sistemi

**Sürüm:** 1.0
**Durum:** Planlama Aşaması
**Teknoloji Yığını:** React (Vite), JavaScript, Tailwind CSS, Supabase (Database & Auth önerilir), Recharts (Grafikler için).

---

## 1. Ürün Özeti
Küçük ve orta ölçekli besi/süt çiftlikleri için; hayvan takibi, yem rasyon yönetimi ve finansal analiz yapabilen, abonelik tabanlı (SaaS) bir web uygulamasıdır. Kullanıcı dostu arayüzü ile teknik bilgisi olmayan çiftçilerin bile kolayca maliyet hesabı yapabilmesini hedefler.

---

## 2. Veri Mimarisi (Örnek Schema Yapısı)

Sistemin temelini oluşturacak veri ilişkileri şöyledir:

* **Farms (Çiftlikler):** `id`, `name`, `subscription_end_date`, `created_at`
* **Users (Kullanıcılar):** `id`, `farm_id` (FK), `role`, `email`
* **Animals (Hayvanlar):** `id`, `farm_id`, `tag_number`, `current_weight`, `birth_date`, `group_id`
* **Feeds (Yemler):** `id`, `farm_id`, `name`, `current_stock_kg`, `price_per_kg`
* **Rations (Rasyonlar):** `id`, `farm_id`, `name`, `content` (JSON: hangi yemden ne kadar var)
* **DailyLogs (Günlük Kayıtlar):** `id`, `farm_id`, `date`, `total_feed_cost`, `operational_cost`



[Image of entity relationship diagram for farm management system]


---

## 3. Kritik İş Mantığı (Business Logic)

### Abonelik Kontrolü (Middleware)
Kullanıcı login olduğunda sistem şu kontrolü yapar:
```javascript
if (today > farm.subscription_end_date) {
  redirect('/payment-renewal');
  block_access();
}

```
### Günlük Maliyet Hesaplama Algoritması
Seçilen Rasyonun içeriğini al.

(Yem A Miktarı * Yem A Fiyatı) + (Yem B Miktarı * Yem B Fiyatı) formülüyle Kişi Başı Rasyon Maliyetini bul.

Bu rasyonu yiyen hayvan sayısı ile çarp.

Sonucu DailyLogs tablosuna yaz ve Feeds tablosundan stok düş.

## 4. Yol Haritası (Roadmap)
Bu liste, geliştirme sürecini takip etmek için kullanılacaktır. Yapılan maddelerin içine x koyarak ilerleyebilirsin.

Faz 1: Kurulum ve Temel Yapı
[x] React (Vite) projesinin oluşturulması ve Tailwind CSS kurulumu.

[x] Supabase projesinin açılması ve veritabanı tablolarının oluşturulması.

[x] Kimlik doğrulama (Login/Register) ekranlarının yapılması.

[x] Çiftlik oluşturma ve Abonelik tarihi atama mantığının kurulması.

[x] Giriş Koruması: Aboneliği biten kullanıcının engellenmesi (Route Protection).

Faz 2: Envanter ve Hayvan Yönetimi
[x] Hayvan Ekleme/Düzenleme/Silme (CRUD) sayfaları.

[x] Hayvan listesi ve filtreleme (Gruplara göre).

[x] Kilo takibi için modal pencere ve veri girişi.

[ x] Yem Ekleme ve Stok güncelleme ekranı.

Faz 3: Rasyon ve Maliyet Motoru (Core Feature)
[ x] Dinamik Rasyon Oluşturucu (Inputlardan yem seçip miktar girme).

[x] "Günlük Beslemeyi Kaydet" butonu ve arka plan hesaplamaları.

[ x] Yem stoğundan otomatik düşüş mantığının kodlanması.

[x ] Hayvan başına maliyetin veritabanına işlenmesi.

Faz 4: Dashboard ve Analiz
[ x] Dashboard ana sayfası (Kartlar: Toplam Hayvan, Kalan Yem, Aylık Gider).

[x ] Kilo artış grafiği (Recharts kullanarak).

[x ] Ayarlar sayfası (Kullanıcı davet etme).

[ x] Owner hesaplarına kullanıcı tanımlama yetkisi ve bu kullanıcılara belli ekranları gösterme ve düzenleme yetkisi

[ ] Excel çıktı alma excel ile kaydetme 

Faz 5: Ürünleştirme (Polish)
[ ] Mobil uyumluluk (Responsive) kontrolleri.

[ x] Hata mesajlarının (Toast notifications) eklenmesi.

[ ] Landing page (Tanıtım sayfası) ve basit bir fiyatlandırma tablosu.



## 5. Teknik Gereksinimler & Kısıtlamalar
Performans: Listeler (Örn: 1000 hayvan) sanallaştırma (virtualization) ile hızlı çalışmalı.

UX: Veri girişleri pratik olmalı, çiftçi arazide tek elle sayı girebilmeli (Büyük inputlar).

Dil: Arayüz tamamen Türkçe olmalı.

to-do
[x] admin tarafında n kullanıcı ekleme ve bu kullanıcıların yetkilerini ayarlaması(veteriner için sadece veteriner sayfasında kayıt yetkisi bazı sayfaların okuma yetkisi gibi)

[ ] stok bitişine 1 hafta kala uyarı mesajı

[ x] rasyonu tek hayvan için giriyorsun raporlara toplam yem mikttarı hesaplama yap çobanla paylaşım için.

[x ]gider ekranında silmede beyz ekran veriyor. siliyor ama hata var. 

[x ] rasyon ve stok ekranında silerken ekran yenilenmiyor.

[ ] excel entegrasyonu

tarih projeksiyon raporu ekle. belirtilen tarihte seçilen hayvanlar kullanıcının girdiği gcaa ya göre ve kullanıcıdan istenen diğer giderlere göre kaç kilo olacaklar, girilen randıman ve karkas fiyatına göre ne kadar kar ettirecek bunları hesapla. projeksiyon raporu ekranına tarih ekleyerek ve kullanıcıdan kilo hesabı mı tarih hesabı diye seçtirerek o ekran üzerinde yaptır bunu.