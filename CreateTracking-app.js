cat > /home/tugas2-vue-ut/js/tracking-app.js << 'JSEOF'
/**
 * tracking-app.js — Logika Vue.js untuk halaman Tracking Delivery Order (tracking.html)
 *
 * Di halaman ini kita bisa:
 *   1. Lihat semua DO yang ada beserta timeline-nya
 *   2. Cari DO by nomor
 *   3. Buat DO baru dengan form lengkap + auto-generate nomor DO
 *
 * Sama seperti stok-app.js, ini pakai Options API Vue 3.
 */

const { createApp } = Vue;

createApp({

  // ===================================================================
  // DATA — semua reactive state tracking page
  // ===================================================================
  data() {
    return {
      // Data referensi dari dummy data (sudah load di HTML sebelum script ini)
      pengirimanList: dataBahanAjar.pengirimanList,
      paketList: dataBahanAjar.paket,
      stokList: dataBahanAjar.stok,  // butuh ini buat lookup judul buku dari kode

      /**
       * Objek tracking — kita convert jadi object dulu supaya bisa dicari by key nomor DO.
       * Waktu ditampilkan nanti diconvert ke array via computed daftarDO.
       */
      tracking: { ...dataBahanAjar.tracking },

      // ===== PENCARIAN =====
      inputCariDO: '',      // Input nomor DO yang dicari
      pesanCariError: '',   // Pesan error kalau DO tidak ketemu

      // ===== MODAL TAMBAH DO =====
      showModalDO: false,
      pesanSuksesDO: '',  // Pesan sukses setelah DO berhasil dibuat

      // Form input untuk DO baru
      formDO: {
        nim: '',
        nama: '',
        ekspedisi: '',
        tanggalKirim: '',
        paket: ''
      },

      // Error validasi per field form DO
      errorsDO: {
        nim: '',
        nama: '',
        ekspedisi: '',
        tanggalKirim: '',
        paket: ''
      },

      // Toast notification
      toastMsg: '',
      toastTimer: null
    };
  },

  // ===================================================================
  // COMPUTED — nilai turunan yang di-cache Vue
  // ===================================================================
  computed: {

    /**
     * daftarDO — convert object tracking jadi array supaya bisa di-loop dengan v-for.
     * Object.keys() ambil semua nomor DO, lalu map ke array of objects.
     * Diurutkan dari yang terbaru (nomor terbesar) ke yang lama.
     */
    daftarDO() {
      return Object.keys(this.tracking)
        .sort((a, b) => b.localeCompare(a))  // sort descending by string (DO2025-003 > DO2025-001)
        .map(nomorDO => ({
          nomorDO,
          ...this.tracking[nomorDO]
        }));
    },

    /**
     * daftarDODitampilkan — filter daftarDO berdasarkan pencarian.
     * Kalau tidak ada pencarian aktif, tampilkan semua.
     */
    daftarDODitampilkan() {
      if (!this.inputCariDO) return this.daftarDO;

      // Filter case-insensitive dan trimming spasi
      const query = this.inputCariDO.trim().toUpperCase();
      return this.daftarDO.filter(item =>
        item.nomorDO.toUpperCase().includes(query)
      );
    },

    /**
     * nomorDOBerikutnya — auto-generate nomor DO berdasarkan yang sudah ada.
     * Format: DO[TAHUN]-[sequence 3 digit zero-padded]
     * Contoh: DO2025-001, DO2025-002, dst.
     */
    nomorDOBerikutnya() {
      const tahun = new Date().getFullYear();
      const prefix = `DO${tahun}-`;

      // Ambil semua nomor DO tahun ini dan cari sequence tertinggi
      const nomorTahunIni = Object.keys(this.tracking)
        .filter(n => n.startsWith(prefix))
        .map(n => parseInt(n.replace(prefix, ''), 10))  // ambil bagian angkanya
        .sort((a, b) => b - a);  // sort descending

      // Kalau sudah ada, increment yang tertinggi. Kalau belum ada, mulai dari 1.
      const sequenceBerikutnya = nomorTahunIni.length > 0 ? nomorTahunIni[0] + 1 : 1;

      // Zero-pad jadi 3 digit, misal 1 → "001", 12 → "012"
      const sequencePadded = String(sequenceBerikutnya).padStart(3, '0');

      return `${prefix}${sequencePadded}`;
    },

    /**
     * paketDipilih — return object paket lengkap berdasarkan kode yang dipilih di form.
     * Kalau belum dipilih, return null.
     */
    paketDipilih() {
      if (!this.formDO.paket) return null;
      return this.paketList.find(p => p.kode === this.formDO.paket) || null;
    },

    /**
     * totalHargaDO — ambil harga dari paket yang dipilih.
     * Otomatis update saat formDO.paket berubah karena ini computed.
     */
    totalHargaDO() {
      if (!this.paketDipilih) return 0;
      return this.paketDipilih.harga;
    }

  },

  // ===================================================================
  // WATCH — pantau perubahan data dan jalankan side effect
  // ===================================================================
  watch: {

    /**
     * Watcher 1: formDO.paket
     * Saat user ganti pilihan paket, log info paket yang dipilih.
     * Di real app ini bisa dipakai buat cek ketersediaan paket secara real-time.
     */
    'formDO.paket'(nilaiBaru) {
      if (nilaiBaru) {
        const paket = this.paketList.find(p => p.kode === nilaiBaru);
        console.log('[Watcher] Paket dipilih:', paket ? paket.nama : nilaiBaru);
        console.log('[Watcher] Harga paket:', paket ? `Rp ${paket.harga.toLocaleString('id-ID')}` : '-');
      }
    },

    /**
     * Watcher 2: tracking (deep watch)
     * Pantau kalau ada DO baru ditambahkan.
     * Dalam kasus nyata, bisa dipakai buat sync ke server.
     */
    tracking: {
      deep: true,
      handler(nilaiBaru) {
        const jumlahDO = Object.keys(nilaiBaru).length;
        console.log('[Watcher] Tracking data update — total DO:', jumlahDO);
      }
    },

    /**
     * Watcher 3: inputCariDO
     * Reset pesan error setiap kali user mulai mengetik nomor baru.
     * Pakai immediate: false (default) karena tidak perlu run saat pertama kali.
     */
    inputCariDO(nilaiBaru) {
      // Saat input berubah, clear pesan error
      if (nilaiBaru !== this.inputCariDO) {
        this.pesanCariError = '';
      }
      // Kalau dikosongkan, reset pencarian
      if (!nilaiBaru) {
        this.pesanCariError = '';
      }
    }

  },

  // ===================================================================
  // METHODS — semua interaksi user
  // ===================================================================
  methods: {

    // ===== HELPER =====

    /**
     * formatRupiah — format angka ke format Rupiah tanpa "Rp".
     */
    formatRupiah(angka) {
      return angka.toLocaleString('id-ID');
    },

    /**
     * formatTanggal — convert "2025-08-25" ke "25 Agustus 2025".
     */
    formatTanggal(tanggalStr) {
      if (!tanggalStr) return '-';
      const bulan = [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const [tahun, bln, tgl] = tanggalStr.split('-');
      return `${parseInt(tgl)} ${bulan[parseInt(bln)]} ${tahun}`;
    },

    /**
     * getNamaPaket — lookup nama paket dari kode.
     */
    getNamaPaket(kodePaket) {
      const p = this.paketList.find(p => p.kode === kodePaket);
      return p ? p.nama : kodePaket;
    },

    /**
     * getJudulBuku — lookup judul buku dari kode MK.
     * Pakai di template buat nampilin isi paket.
     */
    getJudulBuku(kodeMK) {
      const buku = this.stokList.find(s => s.kode === kodeMK);
      return buku ? buku.judul : `(${kodeMK})`;
    },

    /**
     * badgeStatus — return class badge CSS berdasarkan status pengiriman.
     */
    badgeStatus(status) {
      const map = {
        'Terkirim': 'badge-success',
        'Dalam Perjalanan': 'badge-warning',
        'Diproses': 'badge-warning',
        'Menunggu Pickup': 'badge-warning',
        'Gagal Kirim': 'badge-danger',
        'Dibatalkan': 'badge-danger'
      };
      return map[status] || 'badge-warning';
    },

    // ===== PENCARIAN =====

    /**
     * cariDO — filter dan cek hasil pencarian.
     * Kalau tidak ketemu, tampilkan pesan error.
     */
    cariDO() {
      const query = this.inputCariDO.trim().toUpperCase();
      if (!query) {
        this.pesanCariError = 'Masukkan nomor DO terlebih dahulu';
        return;
      }

      // Cek apakah ada hasil di computed daftarDODitampilkan
      const ada = this.daftarDO.some(item =>
        item.nomorDO.toUpperCase().includes(query)
      );

      if (!ada) {
        this.pesanCariError = `Nomor DO "${query}" tidak ditemukan dalam sistem.`;
      } else {
        this.pesanCariError = '';
      }
    },

    /** Reset pencarian ke kondisi awal */
    resetCari() {
      this.inputCariDO = '';
      this.pesanCariError = '';
    },

    // ===== MODAL TAMBAH DO =====

    /** Buka modal dan reset form ke kondisi awal */
    bukaModalTambahDO() {
      this.showModalDO = true;
      this.pesanSuksesDO = '';
      this.resetFormDO();
      this.resetErrorsDO();

      // Isi tanggal kirim dengan tanggal hari ini sebagai default
      // Ini manfaatkan fungsi Date() buat ambil local time
      const today = new Date();
      const tahun = today.getFullYear();
      const bulan = String(today.getMonth() + 1).padStart(2, '0');  // +1 karena bulan 0-indexed
      const tanggal = String(today.getDate()).padStart(2, '0');
      this.formDO.tanggalKirim = `${tahun}-${bulan}-${tanggal}`;
    },

    /** Tutup modal DO */
    tutupModalDO() {
      this.showModalDO = false;
    },

    /** Reset form DO ke kosong */
    resetFormDO() {
      this.formDO = {
        nim: '',
        nama: '',
        ekspedisi: '',
        tanggalKirim: '',
        paket: ''
      };
    },

    /** Reset semua pesan error DO */
    resetErrorsDO() {
      this.errorsDO = {
        nim: '',
        nama: '',
        ekspedisi: '',
        tanggalKirim: '',
        paket: ''
      };
    },

    /**
     * validasiFormDO — validasi semua field wajib DO.
     * Return true kalau semua valid.
     */
    validasiFormDO() {
      this.resetErrorsDO();
      let valid = true;

      // NIM: tidak boleh kosong dan minimal 9 digit angka
      if (!this.formDO.nim.trim()) {
        this.errorsDO.nim = 'NIM wajib diisi';
        valid = false;
      } else if (!/^\d{9,}$/.test(this.formDO.nim.trim())) {
        // Regex: minimal 9 digit angka
        this.errorsDO.nim = 'NIM harus berupa angka minimal 9 digit';
        valid = false;
      }

      // Nama: tidak boleh kosong
      if (!this.formDO.nama.trim()) {
        this.errorsDO.nama = 'Nama wajib diisi';
        valid = false;
      } else if (this.formDO.nama.trim().length < 3) {
        this.errorsDO.nama = 'Nama minimal 3 karakter';
        valid = false;
      }

      // Ekspedisi: wajib pilih salah satu
      if (!this.formDO.ekspedisi) {
        this.errorsDO.ekspedisi = 'Pilih metode ekspedisi';
        valid = false;
      }

      // Tanggal kirim: wajib diisi
      if (!this.formDO.tanggalKirim) {
        this.errorsDO.tanggalKirim = 'Tanggal kirim wajib diisi';
        valid = false;
      }

      // Paket: wajib pilih salah satu
      if (!this.formDO.paket) {
        this.errorsDO.paket = 'Pilih paket bahan ajar';
        valid = false;
      }

      return valid;
    },

    /**
     * simpanDO — buat DO baru dan tambahkan ke object tracking.
     * Nomor DO auto-generate dari computed nomorDOBerikutnya.
     */
    simpanDO() {
      if (!this.validasiFormDO()) return;

      // Ambil nomor DO yang sudah di-generate
      const nomorBaru = this.nomorDOBerikutnya;

      // Buat object DO baru
      const doBaru = {
        nim: this.formDO.nim.trim(),
        nama: this.formDO.nama.trim(),
        status: 'Menunggu Pickup',  // status awal selalu ini
        ekspedisi: this.formDO.ekspedisi,
        tanggalKirim: this.formDO.tanggalKirim,
        paket: this.formDO.paket,
        total: this.totalHargaDO,  // ambil dari computed
        // Perjalanan pertama: penerimaan order dengan timestamp sekarang
        perjalanan: [
          {
            waktu: this.getTimestampSekarang(),
            keterangan: 'Order diterima dan sedang diproses'
          }
        ]
      };

      /**
       * Cara update object reaktif di Vue 3:
       * Cukup assign property baru ke this.tracking — Vue 3 reactive by default.
       * Berbeda dengan Vue 2 yang butuh Vue.set().
       */
      this.tracking[nomorBaru] = doBaru;

      // Tampilkan pesan sukses
      this.pesanSuksesDO = `DO ${nomorBaru} berhasil dibuat untuk ${doBaru.nama}!`;
      this.tampilkanToast(`🚚 ${nomorBaru} berhasil dibuat`);
    },

    /**
     * getTimestampSekarang — return string timestamp format "YYYY-MM-DD HH:MM:SS".
     * Dipakai buat isi waktu di entry perjalanan pertama DO.
     */
    getTimestampSekarang() {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');  // helper zero-pad

      const tgl = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
      const waktu = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      return `${tgl} ${waktu}`;
    },

    // ===== TOAST =====

    /** Tampilkan toast notification yang auto-hilang setelah 3 detik */
    tampilkanToast(pesan) {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastMsg = pesan;
      this.toastTimer = setTimeout(() => {
        this.toastMsg = '';
      }, 3000);
    }

  }

// Mount ke element dengan id="app" di tracking.html
}).mount('#app');
JSEOF
