// Revolut Kurye Randevu Sistemi - Uygulama Mantığı (JS)

document.addEventListener('DOMContentLoaded', () => {
    // Service Worker Kaydı (PWA Yüklenebilirlik için)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.log('Service Worker Kayıt Hatası:', err));
    }

    // Ekranlar
    const screens = {
        welcome: document.getElementById('welcome-screen'),
        calendar: document.getElementById('calendar-screen'),
        success: document.getElementById('success-screen'),
        appointment: document.getElementById('appointment-screen')
    };

    // Butonlar ve Tetikleyiciler
    const btnGoToBooking = document.getElementById('go-to-booking');
    const btnBackToWelcome = document.getElementById('back-to-welcome');
    const btnConfirmBooking = document.getElementById('confirm-booking');
    const btnViewDetails = document.getElementById('view-appointment-details');
    const btnReschedule = document.getElementById('reschedule-btn');
    const btnCancel = document.getElementById('cancel-btn');
    const btnAddToWallet = document.getElementById('add-to-wallet-btn');
    const btnCompleteDelivery = document.getElementById('complete-delivery-btn');

    // Takvim Elemanları
    const monthYearText = document.getElementById('month-year');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const noteInput = document.getElementById('courier-note-input');

    // Başarı ve Takip Ekranlarındaki Dinamik Metinler
    const successDateText = document.getElementById('success-date');
    const successTimeText = document.getElementById('success-time');
    const appointedDateText = document.getElementById('appointed-date');
    const appointedTimeText = document.getElementById('appointed-time');
    const appointedNoteText = document.getElementById('appointed-note');
    const appointedNoteRow = document.getElementById('appointed-note-row');

    // Dinamik PIN Elemanları
    const pinDisplay = document.getElementById('security-pin');
    const pinCountdownText = document.getElementById('pin-countdown');
    const circle = document.querySelector('.progress-ring__circle');
    const radius = 10; // SVG circle radius
    const circumference = 2 * Math.PI * radius;

    // Bahşiş & Puanlama Modali Elemanları
    const ratingModal = document.getElementById('rating-modal');
    const stars = document.querySelectorAll('.star');
    const tipBtns = document.querySelectorAll('.tip-btn');
    const customTipInput = document.getElementById('custom-tip-input');
    const btnSubmitRating = document.getElementById('submit-rating-btn');

    // Tarih Ayarları (2026-06-12 Cuma günündeyiz. Gelecek hafta Salı: 16 Haziran 2026)
    const CURRENT_SYSTEM_DATE = new Date(2026, 5, 12);
    const FIRST_AVAILABLE_DATE = new Date(2026, 5, 16); // 16 Haziran 2026 Salı
    const DEFAULT_TIME_SLOT = "15:50";

    // Seçim Durumları
    let selectedDate = new Date(FIRST_AVAILABLE_DATE);
    let selectedTime = DEFAULT_TIME_SLOT;
    let selectedNote = "";
    let currentViewingMonth = 5; // Haziran
    let currentViewingYear = 2026;

    // PIN ve Sayaç Durumları
    let pinInterval = null;
    let pinCountdownValue = 30;

    // Bahşiş / Puanlama Durumları
    let selectedRating = 5; // Varsayılan 5 yıldız
    let selectedTipAmount = 0;

    // Saat Dilimleri Listesi
    const timeSlots = [
        "09:30", "10:45", "11:15", "13:00", "14:15",
        "15:50", // En uygun saat
        "16:45", "17:30", "18:15"
    ];

    // SVG Çember Çevresi Tanımlama
    if (circle) {
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = 0;
    }

    // Ekran Geçiş Yardımcısı
    function showScreen(screenId) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        screens[screenId].classList.add('active');

        // Sayfa geçişlerine göre sayaç kontrolü
        if (screenId === 'appointment') {
            startPinCountdown();
        } else {
            stopPinCountdown();
        }
    }

    // Push Bildirimi Gösterme Simülasyonu
    function triggerPushNotification(message) {
        const toast = document.getElementById('push-toast');
        const toastText = document.getElementById('toast-message');
        toastText.textContent = message;
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4500);
    }

    // Uygulama Başlangıç Kontrolü
    function checkExistingAppointment() {
        const savedDate = localStorage.getItem('revolut_appointment_date');
        const savedTime = localStorage.getItem('revolut_appointment_time');
        const savedNote = localStorage.getItem('revolut_appointment_note');

        if (savedDate && savedTime) {
            const dateObj = new Date(savedDate);
            updateAppointmentDetailsUI(dateObj, savedTime, savedNote || "");
            showScreen('appointment');
            // Girişte küçük bir bilgi uyarısı verelim
            setTimeout(() => {
                triggerPushNotification("Revolut: Bugün kurye teslimat gününüzde güncel kalmak için takip edin.");
            }, 1000);
        } else {
            showScreen('welcome');
        }
    }

    // Arayüz Randevu Bilgisi Güncelleme
    function updateAppointmentDetailsUI(dateObj, timeStr, noteStr) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('tr-TR', options);

        successDateText.textContent = formattedDate;
        successTimeText.textContent = timeStr;
        appointedDateText.textContent = formattedDate;
        appointedTimeText.textContent = timeStr + " (Önerilen saat)";

        if (noteStr && noteStr.trim() !== "") {
            appointedNoteText.textContent = `"${noteStr}"`;
            appointedNoteRow.style.display = 'flex';
        } else {
            appointedNoteRow.style.display = 'none';
        }
    }

    // Takvimi Hücrelerini Oluşturma
    function renderCalendar() {
        calendarDaysGrid.innerHTML = '';
        const monthNames = [
            "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ];
        
        monthYearText.textContent = `${monthNames[currentViewingMonth]} ${currentViewingYear}`;

        const firstDayOfMonth = new Date(currentViewingYear, currentViewingMonth, 1);
        let startDayIndex = firstDayOfMonth.getDay() - 1; 
        if (startDayIndex === -1) startDayIndex = 6; // Pazar düzeltmesi

        const totalDaysInMonth = new Date(currentViewingYear, currentViewingMonth + 1, 0).getDate();

        // Boş günler
        for (let i = 0; i < startDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('day-cell', 'inactive');
            calendarDaysGrid.appendChild(emptyCell);
        }

        // Seçilebilir günler
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const cellDate = new Date(currentViewingYear, currentViewingMonth, day);
            const dayCell = document.createElement('div');
            dayCell.classList.add('day-cell');
            dayCell.textContent = day;

            if (cellDate.getFullYear() === 2026 && cellDate.getMonth() === 5 && day === 12) {
                dayCell.classList.add('today');
            }

            if (cellDate >= FIRST_AVAILABLE_DATE) {
                dayCell.classList.add('available');
                
                if (selectedDate && 
                    cellDate.getDate() === selectedDate.getDate() && 
                    cellDate.getMonth() === selectedDate.getMonth() && 
                    cellDate.getFullYear() === selectedDate.getFullYear()) {
                    dayCell.classList.add('selected');
                }

                dayCell.addEventListener('click', () => {
                    document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
                    dayCell.classList.add('selected');
                    selectedDate = new Date(currentViewingYear, currentViewingMonth, day);
                });
            } else {
                dayCell.classList.add('inactive');
            }

            calendarDaysGrid.appendChild(dayCell);
        }
    }

    // Saat Dilimleri Oluşturma
    function renderTimeSlots() {
        timeSlotsContainer.innerHTML = '';
        
        timeSlots.forEach(time => {
            const timeSlot = document.createElement('div');
            timeSlot.classList.add('time-slot');
            timeSlot.textContent = time;

            if (time === "15:50") {
                timeSlot.classList.add('recommended');
            }

            if (time === selectedTime) {
                timeSlot.classList.add('selected');
            }

            timeSlot.addEventListener('click', () => {
                document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'));
                timeSlot.classList.add('selected');
                selectedTime = time;
            });

            timeSlotsContainer.appendChild(timeSlot);
        });
    }

    // Dinamik PIN Kod Üretim ve Sayaç Mantığı
    function generateRandomPin() {
        const pin = Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join(' ');
        if (pinDisplay) pinDisplay.textContent = pin;
    }

    function setPinProgress(percent) {
        if (!circle) return;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    function startPinCountdown() {
        if (pinInterval) clearInterval(pinInterval);
        
        generateRandomPin();
        pinCountdownValue = 30;
        if (pinCountdownText) pinCountdownText.textContent = pinCountdownValue;
        setPinProgress(100);

        pinInterval = setInterval(() => {
            pinCountdownValue--;
            if (pinCountdownText) pinCountdownText.textContent = pinCountdownValue;
            setPinProgress((pinCountdownValue / 30) * 100);

            if (pinCountdownValue <= 0) {
                generateRandomPin();
                pinCountdownValue = 30;
            }
        }, 1000);
    }

    function stopPinCountdown() {
        if (pinInterval) {
            clearInterval(pinInterval);
            pinInterval = null;
        }
    }

    // Apple Wallet Simülasyonu
    if (btnAddToWallet) {
        btnAddToWallet.addEventListener('click', () => {
            btnAddToWallet.innerHTML = '✓ Apple Wallet\'a Eklendi';
            btnAddToWallet.style.borderColor = 'var(--success-color)';
            btnAddToWallet.style.color = 'var(--success-color)';
            triggerPushNotification("Revolut: Teslimat randevu kartınız Apple Wallet'a eklendi.");
        });
    }

    // Ay Gezinmeleri
    prevMonthBtn.addEventListener('click', () => {
        if (currentViewingMonth > 5 || currentViewingYear > 2026) {
            currentViewingMonth--;
            if (currentViewingMonth < 0) {
                currentViewingMonth = 11;
                currentViewingYear--;
            }
            renderCalendar();
        }
    });

    nextMonthBtn.addEventListener('click', () => {
        currentViewingMonth++;
        if (currentViewingMonth > 11) {
            currentViewingMonth = 0;
            currentViewingYear++;
        }
        renderCalendar();
    });

    // Randevu İşlemleri ve Kayıt
    btnGoToBooking.addEventListener('click', () => {
        selectedDate = new Date(FIRST_AVAILABLE_DATE);
        selectedTime = DEFAULT_TIME_SLOT;
        if (noteInput) noteInput.value = "";
        renderCalendar();
        renderTimeSlots();
        showScreen('calendar');
    });

    btnBackToWelcome.addEventListener('click', () => {
        showScreen('welcome');
    });

    btnConfirmBooking.addEventListener('click', () => {
        if (!selectedDate) {
            alert('Lütfen bir tarih seçin.');
            return;
        }

        const noteText = noteInput ? noteInput.value.trim() : "";

        // Verileri kaydet
        localStorage.setItem('revolut_appointment_date', selectedDate.toISOString());
        localStorage.setItem('revolut_appointment_time', selectedTime);
        localStorage.setItem('revolut_appointment_note', noteText);

        updateAppointmentDetailsUI(selectedDate, selectedTime, noteText);

        // Başarı ekranına yönlendir
        showScreen('success');

        // Bildirim gönder
        setTimeout(() => {
            triggerPushNotification(`Revolut: Kurye randevunuz sistem tarafından otomatik olarak onaylandı.`);
        }, 1200);
    });

    btnViewDetails.addEventListener('click', () => {
        showScreen('appointment');
    });

    btnReschedule.addEventListener('click', () => {
        const savedDate = localStorage.getItem('revolut_appointment_date');
        const savedTime = localStorage.getItem('revolut_appointment_time');
        const savedNote = localStorage.getItem('revolut_appointment_note');
        
        if (savedDate) {
            selectedDate = new Date(savedDate);
            currentViewingMonth = selectedDate.getMonth();
            currentViewingYear = selectedDate.getFullYear();
        }
        if (savedTime) {
            selectedTime = savedTime;
        }
        if (noteInput) {
            noteInput.value = savedNote || "";
        }
        
        renderCalendar();
        renderTimeSlots();
        showScreen('calendar');
    });

    btnCancel.addEventListener('click', () => {
        const confirmCancel = confirm('Randevunuzu iptal etmek istediğinize emin misiniz?');
        if (confirmCancel) {
            localStorage.removeItem('revolut_appointment_date');
            localStorage.removeItem('revolut_appointment_time');
            localStorage.removeItem('revolut_appointment_note');
            showScreen('welcome');
            triggerPushNotification("Revolut: Kart kurye randevunuz iptal edildi.");
        }
    });

    // --- BAHŞİŞ VE PUANLAMA MODAL MANTIĞI ---
    if (btnCompleteDelivery) {
        btnCompleteDelivery.addEventListener('click', () => {
            // Modali aktif et
            ratingModal.classList.add('active');
            // Yıldızları ve bahşişi sıfırla
            selectedRating = 5;
            selectedTipAmount = 0;
            customTipInput.style.display = 'none';
            customTipInput.value = '';
            stars.forEach((s, idx) => {
                s.classList.add('active');
            });
            tipBtns.forEach(b => b.classList.remove('active'));
        });
    }

    // Yıldız Seçimi Etkileşimi
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.getAttribute('data-rating'));
            selectedRating = rating;

            stars.forEach((s, idx) => {
                if (idx < rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });

    // Bahşiş Butonu Seçimi
    tipBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tipBtns.forEach(b => b.classList.remove('active'));
            const tip = btn.getAttribute('data-tip');

            if (tip === 'custom') {
                btn.classList.add('active');
                customTipInput.style.display = 'block';
                customTipInput.focus();
                selectedTipAmount = 0;
            } else {
                btn.classList.add('active');
                customTipInput.style.display = 'none';
                selectedTipAmount = parseInt(tip);
            }
        });
    });

    // Bahşiş Değerlendirme Gönderme
    if (btnSubmitRating) {
        btnSubmitRating.addEventListener('click', () => {
            let finalTip = selectedTipAmount;
            if (customTipInput.style.display === 'block') {
                finalTip = parseInt(customTipInput.value) || 0;
            }

            // Temizleme ve Ana Ekrana Dönüş
            localStorage.removeItem('revolut_appointment_date');
            localStorage.removeItem('revolut_appointment_time');
            localStorage.removeItem('revolut_appointment_note');
            
            ratingModal.classList.remove('active');
            showScreen('welcome');

            // Bildirim fırlat
            setTimeout(() => {
                let msg = `Geri bildiriminiz için teşekkürler! (Puan: ${selectedRating} Yıldız)`;
                if (finalTip > 0) {
                    msg += ` Kuryemiz Se**** Do**'a ${finalTip}₺ bahşiş başarıyla gönderildi.`;
                }
                triggerPushNotification(msg);
            }, 1000);
        });
    }

    // Başlangıç Kontrolü
    checkExistingAppointment();
});
