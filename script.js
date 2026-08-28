'use strict';

const LIFF_ID = '2011290422-74faHbOe';
const LINE_OA_CHAT_URL =
  'https://line.me/R/oaMessage/%40442pdsyg/?REGISTER';

// This is your Apps Script Web App's /exec URL, used ONLY as a JSON API now
// (doPost). Update this if you redeploy and get a new URL. It does NOT need
// to be the same URL this page is hosted on anymore.
const API_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbypNB3Ijjj8-FWdsD1IHMeBqHVU_qaPxzquLFJF_fwPa7-W_I-a37uyB7UbBjwoeKCP/exec';

const appState = {
  lineUserId: '', lineDisplayName: '', linePictureUrl: '', language: '',
  campaignSource: 'Unknown', accessChannel: 'Web', liffAccessToken: '',
  isLiffReady: false
};
let elements = {};

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  cacheElements();
  bindEvents();
  appState.campaignSource = getCampaignSource();
  if (!await initializeLiffIdentity()) {
    if (!cleanText(elements.startupMessage.textContent)) {
      showStartupError(
        'ไม่สามารถเชื่อมต่อบัญชี LINE ได้ กรุณาเปิดผ่านลิงก์ LIFF และลองใหม่ ' +
        '(Unable to connect your LINE account. Please open the LIFF URL and try again.)'
      );
    }
    return;
  }
  elements.getStartedButton.disabled = false;
  elements.getStartedButton.textContent = 'เริ่มต้นใช้งาน (Get Started)';
  elements.submitButton.disabled = false;
  elements.startupMessage.textContent = '';
}

function cacheElements() {
  elements = {
    startupMessage: document.getElementById('startupMessage'),
    getStartedButton: document.getElementById('getStartedButton'),
    backToWelcomeButton: document.getElementById('backToWelcomeButton'),
    driverForm: document.getElementById('driverForm'),
    title: document.getElementById('title'),
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    phoneNumber: document.getElementById('phoneNumber'),
    titleError: document.getElementById('titleError'),
    firstNameError: document.getElementById('firstNameError'),
    lastNameError: document.getElementById('lastNameError'),
    phoneNumberError: document.getElementById('phoneNumberError'),
    formMessage: document.getElementById('formMessage'),
    submitButton: document.getElementById('submitButton'),
    resultIcon: document.getElementById('resultIcon'),
    resultContent: document.getElementById('resultContent'),
    resultActionButton: document.getElementById('resultActionButton')
  };
}

function bindEvents() {
  elements.getStartedButton.addEventListener('click', function () {
    showScreen('formScreen');
    elements.title.focus();
  });
  elements.backToWelcomeButton.addEventListener('click', function () {
    showScreen('welcomeScreen');
  });
  elements.driverForm.addEventListener('submit', handleFormSubmit);
  elements.title.addEventListener('change', function () { validateTitle(false); });
  elements.firstName.addEventListener('input', function () { validateFirstName(false); });
  elements.lastName.addEventListener('input', function () { validateLastName(false); });
  elements.phoneNumber.addEventListener('input', handlePhoneInput);
  elements.resultActionButton.addEventListener('click', returnToLineChat);
}

async function initializeLiffIdentity() {
  setConnectionStatus('กำลังโหลด LINE SDK... (Loading LINE SDK...)');
  if (!window.liff) {
    showStartupError(getLiffErrorMessage(new Error('LIFF_SDK_NOT_LOADED')));
    return false;
  }
  try {
    setConnectionStatus('กำลังเริ่มต้น LIFF... (Initializing LIFF...)');
    await withTimeout(
      liff.init({ liffId: LIFF_ID }),
      15000,
      'LIFF_INIT_TIMEOUT'
    );
    if (!liff.isLoggedIn()) {
      setConnectionStatus('กำลังเข้าสู่ระบบ LINE... (Signing in to LINE...)');
      if (!liff.isInClient()) {
        liff.login();
        return false;
      }
      throw new Error('LIFF_CLIENT_NOT_LOGGED_IN');
    }
    setConnectionStatus('กำลังโหลดโปรไฟล์ LINE... (Loading LINE profile...)');
    const profile = await withTimeout(
      liff.getProfile(),
      10000,
      'LIFF_PROFILE_TIMEOUT'
    );
    appState.lineUserId = cleanText(profile.userId);
    appState.lineDisplayName = cleanText(profile.displayName);
    appState.linePictureUrl = cleanText(profile.pictureUrl);
    appState.language = getLiffLanguage();
    appState.accessChannel = liff.isInClient() ? 'LIFF' : 'LIFF External Browser';
    appState.liffAccessToken = liff.getAccessToken() || '';
    appState.isLiffReady = Boolean(appState.lineUserId && appState.liffAccessToken);
    return appState.isLiffReady;
  } catch (error) {
    console.error('LIFF initialization error:', error);
    showStartupError(getLiffErrorMessage(error));
    return false;
  }
}

function withTimeout(promise, timeoutMs, errorCode) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      window.setTimeout(function () {
        reject(new Error(errorCode));
      }, timeoutMs);
    })
  ]);
}

function setConnectionStatus(message) {
  elements.getStartedButton.textContent = message;
}

function getLiffErrorMessage(error) {
  const code = cleanText(error && (error.code || error.message));
  if (code.indexOf('LIFF_INIT_TIMEOUT') !== -1) {
    return 'การเชื่อมต่อ LIFF ใช้เวลานานเกินไป กรุณาปิดหน้านี้และเปิดลิงก์ LIFF ใหม่ ' +
      '(LIFF initialization timed out. Please close this page and reopen the LIFF URL.)';
  }
  if (code.indexOf('LIFF_PROFILE_TIMEOUT') !== -1) {
    return 'ไม่สามารถโหลดโปรไฟล์ LINE ได้ กรุณาปิดหน้านี้และลองใหม่ ' +
      '(LINE profile loading timed out. Please close this page and try again.)';
  }
  if (code.indexOf('LIFF_SDK_NOT_LOADED') !== -1) {
    return 'ไม่สามารถโหลด LINE SDK ได้ กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่ ' +
      '(The LINE SDK could not load. Please check your connection and try again.)';
  }
  if (code.indexOf('LIFF_CLIENT_NOT_LOGGED_IN') !== -1) {
    return 'LIFF เปิดใน LINE แต่ไม่พบสถานะการเข้าสู่ระบบ กรุณาปิดหน้าและเปิดลิงก์ LIFF ใหม่ ' +
      '(LIFF opened in LINE without a login session. Please close it and reopen the LIFF URL.)';
  }
  return 'ไม่สามารถเชื่อมต่อ LINE ได้: ' + (code || 'Unknown error');
}

function getLiffLanguage() {
  try {
    if (typeof liff.getAppLanguage === 'function') return cleanText(liff.getAppLanguage());
  } catch (error) {
    console.warn('Unable to read LIFF app language:', error);
  }
  return cleanText(navigator.language);
}

function getCampaignSource() {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get('campaign') || params.get('source') || params.get('utm_source');
  if (direct) return cleanText(direct).substring(0, 100) || 'Unknown';
  const liffState = params.get('liff.state');
  if (liffState) {
    try {
      const stateUrl = new URL(decodeURIComponent(liffState), window.location.origin);
      return cleanText(
        stateUrl.searchParams.get('campaign') ||
        stateUrl.searchParams.get('source') ||
        stateUrl.searchParams.get('utm_source')
      ).substring(0, 100) || 'Unknown';
    } catch (error) {
      console.warn('Unable to parse liff.state:', error);
    }
  }
  return 'Unknown';
}

function handlePhoneInput() {
  elements.phoneNumber.value = elements.phoneNumber.value.replace(/\D/g, '').slice(0, 10);
  validatePhoneNumber(false);
}

function validateForm() {
  return [validateTitle(true), validateFirstName(true), validateLastName(true),
    validatePhoneNumber(true)].every(Boolean);
}

function validateTitle(showRequired) {
  if (['นาย', 'นาง', 'นางสาว'].indexOf(elements.title.value) === -1) {
    setFieldError(elements.titleError, showRequired
      ? 'กรุณาเลือกคำนำหน้าชื่อ (Please select your title.)' : '');
    return false;
  }
  clearFieldError(elements.titleError);
  return true;
}

function validateFirstName(showRequired) {
  if (!cleanText(elements.firstName.value)) {
    setFieldError(elements.firstNameError, showRequired
      ? 'กรุณากรอกชื่อ (Please enter your first name.)' : '');
    return false;
  }
  clearFieldError(elements.firstNameError);
  return true;
}

function validateLastName(showRequired) {
  if (!cleanText(elements.lastName.value)) {
    setFieldError(elements.lastNameError, showRequired
      ? 'กรุณากรอกนามสกุล (Please enter your last name.)' : '');
    return false;
  }
  clearFieldError(elements.lastNameError);
  return true;
}

function validatePhoneNumber(showRequired) {
  const value = elements.phoneNumber.value;
  if (!value) {
    setFieldError(elements.phoneNumberError, showRequired
      ? 'กรุณากรอกเบอร์โทรศัพท์ (Please enter your phone number.)' : '');
    return false;
  }
  if (!/^0\d{9}$/.test(value)) {
    setFieldError(elements.phoneNumberError,
      'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก โดยขึ้นต้นด้วย 0 ' +
      '(Please enter 10 digits beginning with 0.)');
    return false;
  }
  clearFieldError(elements.phoneNumberError);
  return true;
}

function handleFormSubmit(event) {
  event.preventDefault();
  hideFormMessage();
  if (!appState.isLiffReady) {
    showFormMessage('ไม่พบข้อมูลบัญชี LINE กรุณาเปิดแบบฟอร์มใหม่ผ่าน LIFF ' +
      '(LINE identity is unavailable. Please reopen the form through LIFF.)');
    return;
  }
  if (!validateForm()) {
    showFormMessage('กรุณาตรวจสอบข้อมูลที่กรอก (Please check the highlighted information.)');
    return;
  }

  const phoneLocal = elements.phoneNumber.value;
  const payload = {
    lineUserId: appState.lineUserId,
    lineDisplayName: appState.lineDisplayName,
    linePictureUrl: appState.linePictureUrl,
    language: appState.language,
    campaignSource: appState.campaignSource,
    accessChannel: appState.accessChannel,
    liffAccessToken: appState.liffAccessToken,
    title: elements.title.value,
    firstName: cleanText(elements.firstName.value),
    lastName: cleanText(elements.lastName.value),
    phoneNumber: phoneLocal,
    phoneLocal: phoneLocal,
    phoneInternational: toInternationalPhone(phoneLocal)
  };

  elements.submitButton.disabled = true;
  showScreen('processingScreen');
  submitDriverInformation(payload)
    .then(handleSubmissionSuccess)
    .catch(handleSubmissionFailure);
}

/**
 * Calls the Apps Script doPost endpoint directly. text/plain avoids a CORS
 * preflight request, which Apps Script Web Apps don't handle — this must
 * match how Code.gs's doPost() parses event.postData.contents as JSON.
 */
function submitDriverInformation(payload) {
  return fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Network response was not OK (' + response.status + ').');
      }
      return response.json();
    });
}

function handleSubmissionSuccess(response) {
  if (!response || !response.success) {
    handleSubmissionFailure(new Error(response && response.message
      ? response.message : 'Submission failed.'));
    return;
  }
  renderResult(response.matchStatus);
  showScreen('resultScreen');
  elements.submitButton.disabled = false;
}

function handleSubmissionFailure(error) {
  console.error('Submission error:', error);
  renderErrorResult();
  showScreen('resultScreen');
  elements.submitButton.disabled = false;
}

function renderResult(matchStatus) {
  const result = getResultCopy(matchStatus);
  elements.resultIcon.textContent = result.icon;
  elements.resultIcon.classList.toggle('error', Boolean(result.isError));
  elements.resultContent.innerHTML = '<h2>' + escapeHtml(result.thaiTitle) + '</h2>' +
    '<h3>' + escapeHtml(result.englishTitle) + '</h3>' +
    '<p>' + escapeHtml(result.thaiMessage) + '</p>' +
    '<p>' + escapeHtml(result.englishMessage) + '</p>';
  resetResultButton();
}

function getResultCopy(matchStatus) {
  const results = {
    'No Match': ['✓', 'ไม่พบประวัติการสมัครของคุณ', 'No previous application record was found',
      'กรุณากลับไปที่แชท LINE เพื่อดำเนินการสมัครใหม่',
      'Please return to the LINE chat to continue with a new application.'],
    'Existing Applicant': ['✓', 'พบข้อมูลการสมัครของคุณแล้ว', 'Your application record was found',
      'กรุณากลับไปที่แชท LINE เพื่อดำเนินการต่อ',
      'Please return to the LINE chat to continue your application.'],
    'Approved Driver': ['✓', 'พบข้อมูลผู้ขับของคุณแล้ว', 'Your approved driver record was found',
      'กรุณากลับไปที่แชท LINE เพื่อดำเนินการต่อ',
      'Please return to the LINE chat to continue.'],
    'Returning Driver': ['✓', 'พบข้อมูลผู้ขับเดิมของคุณแล้ว', 'Your previous driver record was found',
      'กรุณากลับไปที่แชท LINE เพื่อดำเนินการกลับมารับงานอีกครั้ง',
      'Please return to the LINE chat to continue the return-to-drive process.'],
    'Banned Driver': ['!', 'ไม่สามารถดำเนินการสมัครได้', 'Unable to continue the application',
      'กรุณากลับไปที่แชท LINE เพื่อขอความช่วยเหลือ',
      'Please return to the LINE chat for assistance.', true],
    'Duplicate Drivers': ['!', 'จำเป็นต้องตรวจสอบข้อมูลเพิ่มเติม', 'Additional review is required',
      'กรุณากลับไปที่แชท LINE เพื่อให้เจ้าหน้าที่ช่วยตรวจสอบ',
      'Please return to the LINE chat for manual assistance.', true],
    'Manual Review Required': ['!', 'จำเป็นต้องตรวจสอบข้อมูลเพิ่มเติม', 'Additional review is required',
      'กรุณากลับไปที่แชท LINE เพื่อให้เจ้าหน้าที่ช่วยตรวจสอบ',
      'Please return to the LINE chat for manual assistance.', true]
  };
  const v = results[matchStatus] || results['Manual Review Required'];
  return { icon: v[0], thaiTitle: v[1], englishTitle: v[2],
    thaiMessage: v[3], englishMessage: v[4], isError: Boolean(v[5]) };
}

function renderErrorResult() {
  elements.resultIcon.textContent = '!';
  elements.resultIcon.classList.add('error');
  elements.resultContent.innerHTML = '<h2>ไม่สามารถส่งข้อมูลได้</h2>' +
    '<h3>Unable to submit information</h3>' +
    '<p>เกิดข้อผิดพลาดขณะส่งข้อมูล กรุณากลับไปที่แชท LINE เพื่อลองอีกครั้ง</p>' +
    '<p>An error occurred while submitting your information. Please return to the LINE chat and try again.</p>';
  resetResultButton();
}

function resetResultButton() {
  elements.resultActionButton.disabled = false;
  elements.resultActionButton.textContent = 'กลับไปที่แชท LINE (Return to LINE Chat)';
}

function returnToLineChat() {
  elements.resultActionButton.disabled = true;
  elements.resultActionButton.textContent = 'กำลังกลับไปที่ LINE... (Returning to LINE...)';
  window.location.assign(LINE_OA_CHAT_URL);
}

function toInternationalPhone(localPhone) {
  return /^0\d{9}$/.test(localPhone) ? '66' + localPhone.substring(1) : '';
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showStartupError(message) {
  elements.startupMessage.textContent = message;
  elements.getStartedButton.disabled = true;
  elements.getStartedButton.textContent = 'ไม่สามารถเชื่อมต่อได้ (Unable to connect)';
}
function showFormMessage(message) { elements.formMessage.textContent = message; }
function hideFormMessage() { elements.formMessage.textContent = ''; }
function setFieldError(element, message) { element.textContent = message || ''; }
function clearFieldError(element) { element.textContent = ''; }
function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
