# Tutorial Menjalankan BEI Scanner App di Komputer Lain

Aplikasi ini dibangun menggunakan React dan Vite (Node.js). Berikut adalah langkah-langkah untuk memindahkan dan menjalankan aplikasi ini di komputer teman Anda.

## 1. Persiapan di Komputer Target (Komputer Teman)
- Pastikan **Node.js** sudah terinstal di komputer teman Anda. 
- Anda bisa mengunduhnya dari [nodejs.org](https://nodejs.org/) dan melakukan instalasi standar (pilih versi LTS yang disarankan).

## 2. Memindahkan File Aplikasi
Untuk menghindari ukuran file yang terlalu besar saat dipindahkan, disarankan agar Anda **TIDAK** memindahkan folder `node_modules` (ukurannya sangat besar dan bisa di-install ulang di komputer teman).
1. Di komputer Anda saat ini, masuk ke folder `h:\BOT\SAHAM\bei-scanner-app`.
2. Klik kanan pada folder `bei-scanner-app` lalu kompres menjadi file `.zip` (bisa gunakan WinRAR atau 7-Zip).
3. Pindahkan file `.zip` tersebut melalui Flashdisk atau Google Drive ke komputer teman Anda.
4. Di komputer teman, ekstrak file `.zip` tersebut ke lokasi yang mudah diakses (misalnya di folder *Documents*).
*(Opsional: Jika Anda tidak mengompresnya ke `.zip`, cukup copy seluruh folder `bei-scanner-app` kecuali folder `node_modules` ke flashdisk).*

## 3. Instalasi Dependensi (Package)
Setelah folder berada di komputer teman:
1. Buka folder `bei-scanner-app` yang baru saja di-ekstrak atau di-copy.
2. Klik kanan di area kosong dalam folder tersebut dan pilih **"Open in Terminal"** (Pada Windows 11), atau buka Terminal / Command Prompt lalu ketikkan:
   ```bash
   cd lokasi_folder_bei_scanner_app_di_komputer_teman
   ```
3. Ketik perintah berikut dan tekan **Enter**:
   ```bash
   npm install
   ```
4. Tunggu hingga proses instalasi selesai. Proses ini akan mengunduh kembali folder `node_modules` beserta semua library yang dibutuhkan (seperti React, Vite, dll). Harus ada koneksi internet.

## 4. Menjalankan Aplikasi
1. Kembali ke terminal/command prompt yang masih terbuka di folder program.
2. Jalankan perintah berikut untuk mengaktifkan server-nya:
   ```bash
   npm run dev
   ```
3. Terminal akan menampilkan URL lokal untuk mengakses web, yang biasanya adalah `http://localhost:5173/` (namun mungkin bisa berbeda jika teman Anda membuka aplikasi React lain).
4. Buka browser (Chrome, Edge, Firefox, dll) dan copas atau klik URL tersebut (tahan Ctrl + Klik URL).
5. Aplikasi BEI Scanner Anda sekarang sudah terbuka dan siap digunakan di komputer teman Anda!

---
**Catatan Tambahan:**
Saat menjalankan aplikasi di komputer teman, jika ada fitur analisis AI Stock / Gemini yang pernah Anda tambahkan, fitur tersebut akan tetap berjalan tapi pastikan komputer teman terhubung ke internet dan API Key yang digunakan sudah tersimpan juga (jika memang disetel langsung di dalam aplikasi).
