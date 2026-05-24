cat > /home/tugas2-vue-ut/js/stok-app.js << 'JSEOF'
/**
 * stok-app.js — Logika Vue.js untuk halaman Stok Bahan Ajar (stok.html)
 *
 * File ini menggunakan Vue 3 dengan Options API (bukan Composition API)
 * sesuai materi yang dipelajari di Tugas Praktik 2.
 *
 * Struktur Vue instance:
 *   - data()       → semua variabel reaktif
 *   - computed     → nilai turunan yang otomatis update (cached!)
 *   - watch        → memantau perubahan data tertentu
 *   - methods      → fungsi-fungsi interaksi
 */

const { createApp } = Vue;

createApp({

  // ===================================================================
  // DATA — semua variabel reaktif ada di sini
  // Kalau nilai di sini berubah, Vue otomatis update tampilan yang pakai data ini
  // ===================================================================
  data() {
    return {
      // Ambil data dari file dummy — dataBahanAjar sudah ada di global scope
      // karena dataBahanAjar.js di-load duluan di HTML
      upbjjList: dataBahanAjar.upbjjList,
      kategoriList: dataBahanAjar.kategoriList,

      // Array stok utama — ini yang akan di-filter dan di-sort
      stok: dataBahanAjar.stok,

      // ===== STATE FILTER =====
      filterUpbjj: '',      // UPBJJ yang dipilih, default kosong = semua
      filterKategori: '',   // Kategori MK yang dipilih
      filterKritis: [],     // Array checkbox: bisa isi ['menipis'], ['kosong'], atau keduanya
      sortBy: '',           // Kolom yang dipakai buat sort

      // ===== STATE MODAL TAMBAH =====
      showModalTambah: false,
      pesanSuksesTambah: '',  // Pesan sukses setelah simpan

      // Object form untuk tambah bahan ajar baru
      formTambah: {
        kode: '',
        judul: '',
        kategori: '',
        upbjj: '',
        lokasiRak: '',
        harga: '',
        qty: '',
        safety: '',
        catatanHTML: ''
      },

      // Object error validasi form tambah
      errors: {
        kode: '',
        judul: '',
        kategori: '',
        upbjj: '',
        lokasiRak: '',
        harga: '',
        qty: '',
        safety: ''
      },

      // ===== STATE MODAL EDIT =====
      showModalEdit: false,

      // Form edit — diisi dari data item yang diklik
      formEdit: {
        kode: '',
        judul: '',
        qty: 0,
        safety: 0,
        harga: 0,
        lokasiRak: '',
        catatanHTML: ''
      },

      // Error validasi form edit
      errorsEdit: {
        qty: '',
        safety: ''
      },

      // Simpan referensi index asli item yang lagi diedit
      editIndex: -1,

      // ===== TOAST ===== 
      toastMsg: '',         // Pesan toast, kalau kosong toast tidak ditampilkan
      toastTimer: null      // Timer buat auto-hide toast
    };
  },

  // ===================================================================
  // COMPUTED — properti yang dihitung otomatis dari data lain
  // Keunggulannya: Vue CACHE hasilnya, jadi tidak recompute kalau data dependensinya
  // tidak berubah. Ini lebih efisien dari method yang dipanggil berulang.
  // ===================================================================
  computed: {

    /**
     * stokTerfilter — ini computed utama yang menggabungkan semua filter + sort.
     * Setiap kali filterUpbjj, filterKategori, filterKritis, atau sortBy berubah,
     * computed ini otomatis recalculate.
     */
    stokTerfilter() {
      // Mulai dari seluruh data stok
      let hasil = [...this.stok];

      // === Filter 1: UPBJJ ===
      // Kalau filterUpbjj ada isinya, saring yang upbjj-nya cocok
      if (this.filterUpbjj) {
        hasil = hasil.filter(item => item.upbjj === this.filterUpbjj);
      }

      // === Filter 2: Kategori (dependent — hanya aktif kalau UPBJJ sudah dipilih) ===
      // Sebenarnya Vue bisa filter ini tanpa cek filterUpbjj dulu,
      // tapi kita ikuti logic dependent: kategori hanya bermakna setelah UPBJJ dipilih
      if (this.filterUpbjj && this.filterKategori) {
        hasil = hasil.filter(item => item.kategori === this.filterKategori);
      }

      // === Filter 3: Stok Kritis (checkbox bisa multi-pilih) ===
      if (this.filterKritis.length > 0) {
        hasil = hasil.filter(item => {
          // Kalau checkbox "kosong" dicentang, include item dengan qty = 0
          if (this.filterKritis.includes('kosong') && item.qty === 0) return true;
          // Kalau checkbox "menipis" dicentang, include item dengan 0 < qty < safety
          if (this.filterKritis.includes('menipis') && item.qty > 0 && item.qty < item.safety) return true;
          // Kalau tidak masuk kriteria di atas, exclude
          return false;
        });
      }

      // === Sort ===
      if (this.sortBy === 'judul') {
        // Sort abjad A-Z berdasarkan judul
        hasil.sort((a, b) => a.judul.localeCompare(b.judul));
      } else if (this.sortBy === 'qty') {
        // Sort qty dari terbanyak ke paling sedikit
        hasil.sort((a, b) => b.qty - a.qty);
      } else if (this.sortBy === 'harga') {
        // Sort harga dari termahal ke termurah
        hasil.sort((a, b) => b.harga - a.harga);
      }

      return hasil;
    },

    // Hitung total judul yang ada (sebelum filter)
    totalJudul() {
      return this.stok.length;
    },

    // Hitung berapa item yang stoknya aman (qty >= safety)
    jumlahAman() {
      return this.stok.filter(item => item.qty >= item.safety).length;
    },

    // Hitung berapa item yang stoknya menipis (0 < qty < safety)
    jumlahMenipis() {
      return this.stok.filter(item => item.qty > 0 && item.qty < item.safety).length;
    },

    // Hitung berapa item yang stoknya kosong
    jumlahKosong() {
      return this.stok.filter(item => item.qty === 0).length;
    },

    /**
     * adaFilterAktif — computed boolean untuk deteksi apakah filter sedang aktif.
     * Dipakai buat nampilin badge "Filter Aktif" di header tabel.
     */
    adaFilterAktif() {
      return (
        this.filterUpbjj !== '' ||
        this.filterKategori !== '' ||
        this.filterKritis.length > 0 ||
        this.sortBy !== ''
      );
    },

    /**
     * alertStatusEdit — computed class untuk alert di modal edit.
     * Return class name berdasarkan nilai qty dan safety yang lagi diedit.
     */
    alertStatusEdit() {
      const qty = this.formEdit.qty;
      const safety = this.formEdit.safety;
      if (qty === 0) return 'alert-danger';
      if (qty < safety) return 'alert-warning';
      return 'alert-success';
    },

    /**
     * pesanStatusEdit — teks pesan status untuk preview di modal edit.
     */
    pesanStatusEdit() {
      const qty = this.formEdit.qty;
      const safety = this.formEdit.safety;
      if (qty === 0) return '🚨 Status: KOSONG — Stok habis, perlu pengadaan segera!';
      if (qty < safety) return `⚠️ Status: MENIPIS — Stok (${qty}) di bawah safety (${safety})`;
      return `✅ Status: AMAN — Stok (${qty}) mencukupi dari safety (${safety})`;
    }

  },

  // ===================================================================
  // WATCH — memantau perubahan data spesifik dan jalankan fungsi
  // Berguna buat side effect: misal reset filter dependen saat parent berubah
  // ===================================================================
  watch: {

    /**
     * Watcher 1: filterUpbjj
     * Kalau user ganti pilihan UPBJJ, reset filterKategori ke kosong.
     * Ini implements "dependent options" behavior.
     */
    filterUpbjj(nilaiBaru) {
      // Reset kategori setiap kali UPBJJ berubah
      this.filterKategori = '';
      // Log di console buat debugging (bisa dihapus di production)
      console.log('[Watcher] UPBJJ berubah ke:', nilaiBaru, '→ filterKategori di-reset');
    },

    /**
     * Watcher 2: stok (deep watch)
     * Pantau perubahan di dalam array stok (tambah/edit item).
     * deep: true berarti Vue cek sampai ke dalam object di dalam array.
     * Berguna buat trigger side effect saat data stok berubah.
     */
    stok: {
      deep: true,
      handler(nilaiBaru) {
        console.log('[Watcher] Data stok berubah, total item:', nilaiBaru.length);
        // Bisa dipakai buat auto-save ke localStorage misalnya
        // Tapi untuk sekarang cukup log aja
      }
    },

    /**
     * Watcher 3: filterKritis
     * Pantau perubahan checkbox filter kritis.
     * Kalau checkbox berubah, tampilkan info di console berapa yang difilter.
     */
    filterKritis(nilaiBaru) {
      console.log('[Watcher] Filter kritis berubah:', nilaiBaru);
      // Bisa tambah logic notifikasi kalau mau
    }

  },

  // ===================================================================
  // METHODS — semua fungsi interaksi user ada di sini
  // ===================================================================
  methods: {

    // ===== HELPER FORMAT =====

    /**
     * formatRupiah — format angka jadi format Rupiah Indonesia.
     * Contoh: 65000 → "65.000"
     */
    formatRupiah(angka) {
      return angka.toLocaleString('id-ID');
    },

    /**
     * badgeKategori — return class CSS badge sesuai kategori.
     * Dipakai di :class binding di template.
     */
    badgeKategori(kategori) {
      const map = {
        'MK Wajib': 'badge-success',
        'MK Pilihan': 'badge-warning',
        'Praktikum': 'badge-danger',
        'Problem-Based': 'badge-warning'
      };
      return map[kategori] || 'badge-warning';
    },

    // ===== FILTER & SORT =====

    /**
     * resetFilter — kembalikan semua filter ke default (kosong).
     */
    resetFilter() {
      this.filterUpbjj = '';
      this.filterKategori = '';
      this.filterKritis = [];
      this.sortBy = '';
    },

    /**
     * setSortBy — toggle sort. Kalau column yang sama diklik, reset sort.
     */
    setSortBy(kolom) {
      if (this.sortBy === kolom) {
        this.sortBy = ''; // toggle off
      } else {
        this.sortBy = kolom;
      }
    },

    // ===== MODAL TAMBAH =====

    /** Buka modal form tambah dan reset form */
    bukaModalTambah() {
      this.showModalTambah = true;
      this.pesanSuksesTambah = '';
      this.resetFormTambah();
      this.resetErrors();
    },

    /** Tutup modal tambah */
    tutupModalTambah() {
      this.showModalTambah = false;
    },

    /** Reset semua field form tambah ke nilai awal */
    resetFormTambah() {
      this.formTambah = {
        kode: '',
        judul: '',
        kategori: '',
        upbjj: '',
        lokasiRak: '',
        harga: '',
        qty: '',
        safety: '',
        catatanHTML: ''
      };
    },

    /** Reset semua pesan error */
    resetErrors() {
      this.errors = {
        kode: '', judul: '', kategori: '',
        upbjj: '', lokasiRak: '', harga: '',
        qty: '', safety: ''
      };
    },

    /**
     * validasiFormTambah — validasi sederhana sebelum simpan.
     * Return true kalau semua valid, false kalau ada yang kosong/salah.
     */
    validasiFormTambah() {
      this.resetErrors();
      let valid = true;

      // Cek kode — tidak boleh kosong dan tidak boleh duplikat
      if (!this.formTambah.kode.trim()) {
        this.errors.kode = 'Kode MK wajib diisi';
        valid = false;
      } else {
        // Cek duplikat kode — bandingkan dengan data yang sudah ada
        const kodeExist = this.stok.find(
          item => item.kode.toLowerCase() === this.formTambah.kode.toLowerCase()
        );
        if (kodeExist) {
          this.errors.kode = 'Kode MK sudah ada dalam sistem';
          valid = false;
        }
      }

      // Cek field wajib lainnya
      if (!this.formTambah.judul.trim()) {
        this.errors.judul = 'Judul bahan ajar wajib diisi';
        valid = false;
      }
      if (!this.formTambah.kategori) {
        this.errors.kategori = 'Pilih kategori mata kuliah';
        valid = false;
      }
      if (!this.formTambah.upbjj) {
        this.errors.upbjj = 'Pilih UT-Daerah (UPBJJ)';
        valid = false;
      }
      if (!this.formTambah.lokasiRak.trim()) {
        this.errors.lokasiRak = 'Lokasi rak wajib diisi';
        valid = false;
      }

      // Validasi angka — harus lebih dari 0
      if (this.formTambah.harga === '' || this.formTambah.harga < 0) {
        this.errors.harga = 'Harga harus diisi dan tidak boleh negatif';
        valid = false;
      }
      if (this.formTambah.qty === '' || this.formTambah.qty < 0) {
        this.errors.qty = 'Jumlah stok harus diisi dan tidak boleh negatif';
        valid = false;
      }
      if (this.formTambah.safety === '' || this.formTambah.safety < 0) {
        this.errors.safety = 'Safety stock harus diisi dan tidak boleh negatif';
        valid = false;
      }

      return valid;
    },

    /**
     * simpanTambah — validasi lalu push data baru ke array stok.
     * Vue reaktivitas akan otomatis update tabel.
     */
    simpanTambah() {
      if (!this.validasiFormTambah()) return;

      // Buat object baru dari data form
      const itemBaru = {
        kode: this.formTambah.kode.toUpperCase().trim(),
        judul: this.formTambah.judul.trim(),
        kategori: this.formTambah.kategori,
        upbjj: this.formTambah.upbjj,
        lokasiRak: this.formTambah.lokasiRak.toUpperCase().trim(),
        harga: Number(this.formTambah.harga),
        qty: Number(this.formTambah.qty),
        safety: Number(this.formTambah.safety),
        catatanHTML: this.formTambah.catatanHTML || '-'
      };

      // Push ke array stok — ini trigger watcher stok dan recompute stokTerfilter
      this.stok.push(itemBaru);

      // Tampilkan pesan sukses di modal
      this.pesanSuksesTambah = `Bahan ajar "${itemBaru.judul}" berhasil ditambahkan!`;

      // Juga tampilkan toast
      this.tampilkanToast(`✅ ${itemBaru.kode} berhasil ditambahkan`);
    },

    // ===== MODAL EDIT =====

    /**
     * bukaModalEdit — isi formEdit dengan data item yang dipilih.
     * Pakai Object.assign atau spread supaya formEdit tidak reference langsung ke data asli
     * (kalau user cancel, data asli tidak ikut berubah).
     */
    bukaModalEdit(item) {
      // Spread operator untuk copy, bukan reference
      this.formEdit = { ...item };

      // Simpan referensi index untuk keperluan update nanti
      this.editIndex = this.stok.findIndex(s => s.kode === item.kode);

      // Reset error edit
      this.errorsEdit = { qty: '', safety: '' };
      this.showModalEdit = true;
    },

    /** Tutup modal edit */
    tutupModalEdit() {
      this.showModalEdit = false;
    },

    /**
     * validasiFormEdit — validasi minimal untuk form edit.
     */
    validasiFormEdit() {
      this.errorsEdit = { qty: '', safety: '' };
      let valid = true;

      if (this.formEdit.qty === '' || this.formEdit.qty < 0) {
        this.errorsEdit.qty = 'Qty tidak boleh kosong atau negatif';
        valid = false;
      }
      if (this.formEdit.safety === '' || this.formEdit.safety < 0) {
        this.errorsEdit.safety = 'Safety stock tidak boleh kosong atau negatif';
        valid = false;
      }

      return valid;
    },

    /**
     * simpanEdit — update item di array stok dengan data dari formEdit.
     * Pakai Vue.set atau Object.assign supaya reaktivitas tetap jalan.
     */
    simpanEdit() {
      if (!this.validasiFormEdit()) return;

      // Update item di array dengan spread (replace keseluruhan object)
      // Ini lebih aman daripada mutate property satu-satu
      this.stok[this.editIndex] = {
        ...this.stok[this.editIndex],  // pertahankan field yang tidak diedit
        qty: Number(this.formEdit.qty),
        safety: Number(this.formEdit.safety),
        harga: Number(this.formEdit.harga),
        lokasiRak: this.formEdit.lokasiRak,
        catatanHTML: this.formEdit.catatanHTML
      };

      // Tutup modal dan tampilkan toast
      this.tutupModalEdit();
      this.tampilkanToast(`✅ Stok ${this.formEdit.kode} berhasil diperbarui`);
    },

    // ===== TOAST =====

    /**
     * tampilkanToast — tampilkan notifikasi kecil yang auto-hilang setelah 3 detik.
     */
    tampilkanToast(pesan) {
      // Kalau ada timer yang masih jalan, stop dulu
      if (this.toastTimer) clearTimeout(this.toastTimer);

      this.toastMsg = pesan;

      // Set timer auto-hide setelah 3 detik
      this.toastTimer = setTimeout(() => {
        this.toastMsg = '';
      }, 3000);
    }

  }

// Mount Vue ke element dengan id="app" di stok.html
}).mount('#app');
JSEOF
