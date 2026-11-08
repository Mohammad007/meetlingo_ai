/**
 * Curated word lists for Hinglish output. All keys are Devanagari as produced by ML Kit EN->HI.
 * These are deterministic, reviewable rules — not a language model.
 */

/** Conventional Roman-Hindi spellings for very frequent words (both Hinglish styles). */
export const COMMON_SPELLINGS: Record<string, string> = {
  है: 'hai', हैं: 'hain', था: 'tha', थी: 'thi', थे: 'the', में: 'mein', मैं: 'main', नहीं: 'nahi', नही: 'nahi',
  और: 'aur', या: 'ya', को: 'ko', का: 'ka', की: 'ki', के: 'ke', से: 'se', पर: 'par', ने: 'ne',
  हम: 'hum', हमें: 'humein', हमारा: 'hamara', हमारी: 'hamari', हमारे: 'hamare',
  आप: 'aap', आपका: 'aapka', आपकी: 'aapki', आपके: 'aapke', आपको: 'aapko',
  तुम: 'tum', तुम्हारा: 'tumhara', वह: 'woh', वे: 'woh', वो: 'woh', यह: 'yeh', ये: 'ye', कि: 'ki',
  क्या: 'kya', क्यों: 'kyun', कैसे: 'kaise', कब: 'kab', कहाँ: 'kahan', कहां: 'kahan', कौन: 'kaun',
  जो: 'jo', भी: 'bhi', ही: 'hi', तो: 'toh', अब: 'ab', फिर: 'phir', सब: 'sab', सभी: 'sabhi',
  बहुत: 'bahut', कुछ: 'kuch', एक: 'ek', दो: 'do', तीन: 'teen', चार: 'chaar', पांच: 'paanch', पाँच: 'paanch',
  आज: 'aaj', कल: 'kal', अभी: 'abhi', पहले: 'pehle', बाद: 'baad', लिए: 'liye', साथ: 'saath', बारे: 'baare',
  करना: 'karna', करें: 'karein', करेंगे: 'karenge', करेगा: 'karega', करेगी: 'karegi', करूंगा: 'karunga',
  करूँगा: 'karunga', करूंगी: 'karungi', करो: 'karo', कर: 'kar', करते: 'karte', करता: 'karta', करती: 'karti',
  किया: 'kiya', कीजिए: 'kijiye', करने: 'karne', करके: 'karke',
  होना: 'hona', होगा: 'hoga', होगी: 'hogi', होंगे: 'honge', हो: 'ho', हुआ: 'hua', हुई: 'hui', हुए: 'hue',
  होने: 'hone', रहा: 'raha', रही: 'rahi', रहे: 'rahe', गया: 'gaya', गई: 'gayi', गए: 'gaye',
  चाहिए: 'chahiye', सकते: 'sakte', सकता: 'sakta', सकती: 'sakti', सके: 'sake', सकें: 'sakein',
  दें: 'dein', दे: 'de', देना: 'dena', दिया: 'diya', देंगे: 'denge', लें: 'lein', ले: 'le', लेना: 'lena',
  जाना: 'jana', जाएगा: 'jayega', जाएगी: 'jayegi', जाएंगे: 'jayenge', जाए: 'jaye', जाता: 'jata',
  मुझे: 'mujhe', मेरा: 'mera', मेरी: 'meri', मेरे: 'mere', उन्हें: 'unhe', उसे: 'usey', इसे: 'isey',
  उनका: 'unka', उनकी: 'unki', उनके: 'unke', उसका: 'uska', उसकी: 'uski', उसके: 'uske', इसका: 'iska',
  इसकी: 'iski', इसके: 'iske', इस: 'is', उस: 'us', इन: 'in', उन: 'un',
  अपना: 'apna', अपनी: 'apni', अपने: 'apne', ठीक: 'theek', हाँ: 'haan', हां: 'haan', जी: 'ji',
  नमस्ते: 'namaste', लेकिन: 'lekin', क्योंकि: 'kyunki', अगर: 'agar', जब: 'jab', तब: 'tab',
  यहाँ: 'yahan', यहां: 'yahan', वहाँ: 'wahan', वहां: 'wahan', चलो: 'chalo', बात: 'baat', काम: 'kaam',
  समय: 'samay', दिन: 'din', सारे: 'saare', सारी: 'saari', सारा: 'saara', हर: 'har', कोई: 'koi',
  किसी: 'kisi', बस: 'bas', ज़रूर: 'zaroor', जरूर: 'zaroor', शायद: 'shayad', ज़रूरी: 'zaroori', जरूरी: 'zaroori',
  मैंने: 'maine', हमने: 'humne', आपने: 'aapne', उन्होंने: 'unhone', उसने: 'usne',
  भेजें: 'bhejein', भेजना: 'bhejna', भेजने: 'bhejne', भेज: 'bhej', देखें: 'dekhein', देखना: 'dekhna',
  बताएं: 'batayein', बताओ: 'batao', बताना: 'batana', सुनो: 'suno', सुनिए: 'suniye',
};

/** English loanwords that ML Kit writes in Devanagari; restored to English in both Hinglish styles. */
export const LOANWORDS: Record<string, string> = {
  डैशबोर्ड: 'dashboard', बिल्ड: 'build', टीम: 'team', ऐप: 'app', एप: 'app', ऐप्स: 'apps', अपडेट: 'update',
  टेस्ट: 'test', टेस्टिंग: 'testing', मीटिंग: 'meeting', सर्वर: 'server', कोड: 'code', फ़ाइल: 'file',
  फाइल: 'file', ईमेल: 'email', क्लाइंट: 'client', प्रोजेक्ट: 'project', रिपोर्ट: 'report', डेटा: 'data',
  डाटा: 'data', फीडबैक: 'feedback', फ़ीडबैक: 'feedback', डेडलाइन: 'deadline', लॉन्च: 'launch',
  रिलीज़: 'release', रिलीज: 'release', बग: 'bug', बग्स: 'bugs', फ़ीचर: 'feature', फीचर: 'feature',
  यूज़र: 'user', यूजर: 'user', स्क्रीन: 'screen', लिंक: 'link', ऑफिस: 'office', कॉल: 'call',
  मैसेज: 'message', फ़ोन: 'phone', फोन: 'phone', लैपटॉप: 'laptop', वेबसाइट: 'website', सिस्टम: 'system',
  प्रोसेस: 'process', प्लान: 'plan', टास्क: 'task', डिज़ाइन: 'design', डिजाइन: 'design', डेवलपर: 'developer',
  एपीआई: 'API', एसडीके: 'SDK', एपीके: 'APK', डिप्लॉयमेंट: 'deployment', मोबाइल: 'mobile',
  एंड्रॉइड: 'Android', एंड्रॉयड: 'Android', सॉफ्टवेयर: 'software', सॉफ़्टवेयर: 'software',
  इंटरनेट: 'internet', ऑनलाइन: 'online', ऑफ़लाइन: 'offline', ऑफलाइन: 'offline', स्टेटस: 'status',
  स्प्रिंट: 'sprint', डेमो: 'demo', बैकएंड: 'backend', फ्रंटएंड: 'frontend', लॉगिन: 'login',
  पासवर्ड: 'password', बटन: 'button', पेज: 'page', वर्ज़न: 'version', वर्जन: 'version', ब्राउज़र: 'browser',
  क्लाउड: 'cloud', डेटाबेस: 'database', सर्विस: 'service', प्रोडक्ट: 'product', मैनेजर: 'manager',
  प्रेजेंटेशन: 'presentation', स्लाइड: 'slide', स्लाइड्स: 'slides', वीडियो: 'video', ऑडियो: 'audio',
  हैलो: 'hello', हेलो: 'hello', हाय: 'hi', ओके: 'okay', बाय: 'bye', सॉरी: 'sorry',
  थैंक्स: 'thanks', प्लीज़: 'please', प्लीज: 'please', गुड: 'good', मॉर्निंग: 'morning', नाइस: 'nice',
  माइक: 'mic', माइक्रोफ़ोन: 'microphone', माइक्रोफोन: 'microphone', चैट: 'chat', ज़ूम: 'Zoom',
};

/**
 * Formal / Sanskritised Hindi words that natural spoken Hinglish replaces with English.
 * Applied only for the "natural" style; "simple" keeps the Hindi word romanised.
 */
export const COLLOQUIAL: Record<string, string> = {
  कृपया: 'please', नवीनतम: 'latest', साझा: 'share', परीक्षण: 'testing', परीक्षा: 'test',
  समस्याओं: 'issues', समस्याएं: 'issues', समस्याएँ: 'issues', समस्या: 'issue', अद्यतन: 'update',
  अद्यतित: 'updated', बैठक: 'meeting', संस्करण: 'version', पुष्टि: 'confirm', प्रतिक्रिया: 'response',
  सप्ताह: 'week', प्रबंधक: 'manager', ग्राहक: 'client', परियोजना: 'project', विवरण: 'details',
  दस्तावेज़: 'document', दस्तावेज: 'document', सूची: 'list', त्रुटि: 'error', त्रुटियों: 'errors',
  त्रुटियां: 'errors', सुधार: 'fix', सुविधा: 'feature', सुविधाओं: 'features', उपयोगकर्ता: 'user',
  उपयोगकर्ताओं: 'users', संदेश: 'message', अनुप्रयोग: 'app', आवेदन: 'application', योजना: 'plan',
  धन्यवाद: 'thanks', स्वागत: 'welcome', प्रस्तुति: 'presentation', समीक्षा: 'review', अनुमोदन: 'approval',
  परिनियोजन: 'deployment', प्रणाली: 'system', डेटासेट: 'dataset', सर्वोत्तम: 'best', तत्काल: 'urgent',
  निर्धारित: 'scheduled', प्राथमिकता: 'priority', लक्ष्य: 'target', संपर्क: 'contact', सत्यापित: 'verify',
  उपयोग: 'use', प्रयोग: 'use', जानकारी: 'information', अनुरोध: 'request', प्रगति: 'progress',
};

/** Spoken names of Latin letters in Devanagari, used to restore acronyms (API -> एपीआई). */
export const LETTER_NAMES: Record<string, string> = {
  A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ', G: 'जी', H: 'एच', I: 'आई', J: 'जे', K: 'के',
  L: 'एल', M: 'एम', N: 'एन', O: 'ओ', P: 'पी', Q: 'क्यू', R: 'आर', S: 'एस', T: 'टी', U: 'यू', V: 'वी',
  W: 'डब्ल्यू', X: 'एक्स', Y: 'वाई', Z: 'ज़ेड',
};
