// Soil care data + pure logic (no DOM, no imports) so it can be unit-tested in Node.
//
// Three tools share this file:
//   1. Soil Health Card  -> PARAMS, rateParam(), assess(), STATUS_LABEL, MEANING
//   2. Find my soil type -> QUIZ, scoreSoil()
//   3. Fertilizer advice -> ADVICE, adviceFor(), SOIL_TIPS
//
// Every farmer-facing sentence exists in English, Hindi and Marathi: { en, hi, mr }.
// Advice is deliberately GENERAL (no kg/acre doses): the exact quantity comes from the
// farmer's Soil Health Card or the local Krishi Vigyan Kendra (KVK), matching the
// assistant's rule of never inventing dosages.
//
// Ratings use the limits commonly printed on Indian Soil Health Cards. If a card shows a
// different rating, the card wins (the UI says so).

// ------------------------------------------------------------------ UI strings
export const SOIL_UI = {
  hubEyebrow: { en: 'Know your soil, look after it', hi: 'अपनी मिट्टी को जानें, उसकी देखभाल करें', mr: 'तुमची माती ओळखा, तिची निगा राखा' },
  hubTitle: { en: 'Soil care', hi: 'मिट्टी की देखभाल', mr: 'मातीची निगा' },
  hubDesc: { en: "Everything about your soil in one place. Start with whichever fits you today. You can move between tools any time.", hi: "अपनी मिट्टी से जुड़ी हर चीज़ एक जगह। आज जो आपके काम का हो उससे शुरू करें। कभी भी एक से दूसरे में जा सकते हैं।", mr: "तुमच्या मातीबद्दल सर्व काही एकाच ठिकाणी. आज जे तुमच्या कामाचे ते निवडा. केव्हाही एकातून दुसऱ्यात जाऊ शकता." },
  hubHint: { en: "Not sure where to begin? No card yet: try \"Find my soil type\" or \"Where to get tested\". Have a card: start with \"Soil Health Card\".", hi: "कहाँ से शुरू करें? कार्ड नहीं है तो \"अपनी मिट्टी पहचानें\" या \"जाँच कहाँ करवाएँ\" देखें। कार्ड है तो \"मृदा स्वास्थ्य कार्ड\" से।", mr: "कुठून सुरू करावे? पत्रिका नसेल तर \"माझी माती ओळखा\" किंवा \"चाचणी कुठे करावी\" पहा; पत्रिका असेल तर \"मृदा आरोग्य पत्रिका\" पासून." },

  cardTitle: { en: 'Soil Health Card', hi: 'मृदा स्वास्थ्य कार्ड', mr: 'मृदा आरोग्य पत्रिका' },
  cardBlurb: { en: 'Type in the values from your card and see what each one means.', hi: 'अपने कार्ड के मान भरें और हर एक का मतलब समझें।', mr: 'तुमच्या पत्रिकेतील मूल्ये भरा आणि प्रत्येकाचा अर्थ समजून घ्या.' },
  finderTitle: { en: 'Find my soil type', hi: 'अपनी मिट्टी पहचानें', mr: 'माझी माती ओळखा' },
  finderBlurb: { en: 'Not sure if it is black, red or sandy? Answer five simple questions.', hi: 'पता नहीं काली है, लाल या रेतीली? पाँच आसान सवालों के जवाब दें।', mr: 'काळी, लाल की वाळूमिश्रित ते माहीत नाही? पाच सोप्या प्रश्नांची उत्तरे द्या.' },
  adviceTitle: { en: 'Fertilizer & soil advice', hi: 'खाद व मिट्टी सुधार सलाह', mr: 'खत व माती सुधारणा सल्ला' },
  adviceBlurb: { en: 'General steps to improve your soil, based on its type and your card.', hi: 'मिट्टी के प्रकार और आपके कार्ड के आधार पर सुधार के सामान्य कदम।', mr: 'मातीचा प्रकार व तुमच्या पत्रिकेनुसार सुधारणेसाठी सामान्य उपाय.' },

  open: { en: 'Open', hi: 'खोलें', mr: 'उघडा' },
  back: { en: 'Back to Soil care', hi: 'मिट्टी की देखभाल पर लौटें', mr: 'मातीची निगा कडे परत' },
  toolsAria: { en: 'Soil care tools', hi: 'मिट्टी देखभाल के साधन', mr: 'मातीची निगा साधने' },
  chipNone: { en: 'Not started', hi: 'शुरू नहीं किया', mr: 'सुरू केलेले नाही' },
  chipCardFine: { en: 'Card saved · all fine', hi: 'कार्ड सहेजा · सब ठीक', mr: 'पत्रिका जतन · सर्व ठीक' },
  chipCardAttn: { en: 'Card saved · {n} need attention', hi: 'कार्ड सहेजा · {n} पर ध्यान दें', mr: 'पत्रिका जतन · {n} कडे लक्ष द्या' },
  chipFinder: { en: 'Result: {soil}', hi: 'नतीजा: {soil}', mr: 'निकाल: {soil}' },
  chipAdvice: { en: 'For: {soil}', hi: 'के लिए: {soil}', mr: 'साठी: {soil}' },

  // --- Soil Health Card screen
  cardDesc: { en: 'Type the numbers printed on your card. Leave blank anything your card does not show. Everything stays on this device.', hi: 'अपने कार्ड पर छपे अंक भरें। जो कार्ड में न हो उसे खाली छोड़ें। सब कुछ इसी डिवाइस पर रहता है।', mr: 'तुमच्या पत्रिकेवर छापलेले आकडे भरा. जे पत्रिकेत नाही ते रिकामे सोडा. सर्व काही याच डिव्हाइसवर राहते.' },
  plotLabel: { en: 'Plot name or survey no. (optional)', hi: 'खेत का नाम या सर्वे नं. (वैकल्पिक)', mr: 'शेताचे नाव किंवा गट/सर्वे क्र. (ऐच्छिक)' },
  mainGroup: { en: 'Main soil health', hi: 'मुख्य मिट्टी स्वास्थ्य', mr: 'मातीचे मुख्य आरोग्य' },
  microGroup: { en: 'Secondary & micronutrients (tap to open)', hi: 'द्वितीयक व सूक्ष्म पोषक तत्व (खोलने के लिए दबाएँ)', mr: 'दुय्यम व सूक्ष्म अन्नद्रव्ये (उघडण्यासाठी दाबा)' },
  saveCard: { en: 'Save card', hi: 'कार्ड सहेजें', mr: 'पत्रिका जतन करा' },
  clearCard: { en: 'Clear', hi: 'साफ़ करें', mr: 'पुसा' },
  cardSavedToast: { en: 'Soil Health Card saved on this device', hi: 'मृदा स्वास्थ्य कार्ड इस डिवाइस पर सहेजा गया', mr: 'मृदा आरोग्य पत्रिका या डिव्हाइसवर जतन केली' },
  cardClearedToast: { en: "Form cleared (your saved card is kept)", hi: "फ़ॉर्म साफ़ किया (सहेजा कार्ड सुरक्षित है)", mr: "फॉर्म पुसला (जतन केलेली पत्रिका तशीच आहे)" },
  fixFirst: { en: 'Fix the highlighted numbers first', hi: 'पहले चिह्नित अंक ठीक करें', mr: 'आधी दर्शवलेले आकडे दुरुस्त करा' },
  needOne: { en: 'Enter at least one value', hi: 'कम से कम एक मान भरें', mr: 'किमान एक मूल्य भरा' },
  invalid: { en: 'Check this number: it should be between {min} and {max}', hi: 'यह अंक जाँचें: {min} से {max} के बीच होना चाहिए', mr: 'हा आकडा तपासा: {min} ते {max} दरम्यान हवा' },
  resultsTitle: { en: 'What your numbers mean', hi: 'आपके अंकों का मतलब', mr: 'तुमच्या आकड्यांचा अर्थ' },
  resultsEmpty: { en: 'Enter a value on the left to see what it means.', hi: 'मतलब देखने के लिए कोई मान भरें।', mr: 'अर्थ पाहण्यासाठी एखादे मूल्य भरा.' },
  rangeNote: { en: 'Ratings follow commonly used Soil Health Card limits. If your card shows a different rating, trust the card.', hi: 'रेटिंग मृदा स्वास्थ्य कार्ड की आम सीमाओं के अनुसार हैं। कार्ड में अलग रेटिंग हो तो कार्ड को मानें।', mr: 'श्रेणी मृदा आरोग्य पत्रिकेच्या सामान्य मर्यादांनुसार आहेत. पत्रिकेत वेगळी श्रेणी असल्यास पत्रिकेवर विश्वास ठेवा.' },
  whatIs: { en: 'What is this?', hi: 'यह क्या है?', mr: 'हे काय आहे?' },
  savedOn: { en: 'Saved on {date}', hi: '{date} को सहेजा', mr: '{date} रोजी जतन केले' },
  nextAdvice: { en: 'Get advice for these results', hi: 'इन नतीजों के लिए सलाह पाएँ', mr: 'या निकालांसाठी सल्ला मिळवा' },
  noCardNote: { en: 'No card yet? Get one through the government Soil Health Card scheme (soilhealth.dac.gov.in) or your KVK.', hi: 'अभी कार्ड नहीं है? सरकारी मृदा स्वास्थ्य कार्ड योजना (soilhealth.dac.gov.in) या अपने KVK से बनवाएँ।', mr: 'पत्रिका नाही? सरकारी मृदा आरोग्य पत्रिका योजना (soilhealth.dac.gov.in) किंवा तुमच्या KVK कडून मिळवा.' },

  // --- Find my soil type screen
  finderDesc: { en: 'Answer from what you see in your own field. Pick the closest option; there are no wrong answers.', hi: 'अपने खेत में जो दिखता है उसके हिसाब से जवाब दें। सबसे नज़दीकी विकल्प चुनें; कोई जवाब गलत नहीं।', mr: 'तुमच्या शेतात जे दिसते त्यानुसार उत्तर द्या. सर्वात जवळचा पर्याय निवडा; कोणतेही उत्तर चुकीचे नाही.' },
  qOf: { en: 'Question {n} of {total}', hi: 'सवाल {n} / {total}', mr: 'प्रश्न {n} / {total}' },
  prev: { en: 'Previous', hi: 'पिछला', mr: 'मागील' },
  next: { en: 'Next', hi: 'अगला', mr: 'पुढील' },
  seeResult: { en: 'See my result', hi: 'मेरा नतीजा देखें', mr: 'माझा निकाल पहा' },
  resultEyebrow: { en: 'Your soil looks like', hi: 'आपकी मिट्टी ऐसी लगती है', mr: 'तुमची माती अशी दिसते' },
  strongMatch: { en: 'Strong match', hi: 'पक्का मेल', mr: 'अचूक जुळणी' },
  likelyMatch: { en: 'Likely match', hi: 'संभावित मेल', mr: 'शक्यतो जुळते' },
  alsoClose: { en: 'Also close to: {soil}', hi: 'इसके भी करीब: {soil}', mr: 'याच्याशीही जवळची: {soil}' },
  useSoil: { en: 'Use this soil in my farm profile', hi: 'इसे अपने खेत प्रोफ़ाइल में लें', mr: 'ही माती माझ्या शेत प्रोफाइलमध्ये वापरा' },
  usedSoil: { en: '✓ Added to your farm profile', hi: '✓ खेत प्रोफ़ाइल में जोड़ा गया', mr: '✓ शेत प्रोफाइलमध्ये जोडले' },
  usedToast: { en: 'Soil set to {soil}. The crop planner will use it.', hi: 'मिट्टी {soil} तय हुई। फसल योजनाकार इसका उपयोग करेगा।', mr: 'माती {soil} निश्चित केली. पीक नियोजक ती वापरेल.' },
  retake: { en: 'Retake quiz', hi: 'क्विज़ दोबारा दें', mr: 'प्रश्नावली पुन्हा द्या' },
  notEnough: { en: 'These answers did not point to one soil. Try again and pick the closest option for each question.', hi: 'इन जवाबों से एक मिट्टी तय नहीं हुई। फिर कोशिश करें और हर सवाल में सबसे नज़दीकी विकल्प चुनें।', mr: 'या उत्तरांवरून एक माती ठरली नाही. पुन्हा प्रयत्न करा व प्रत्येक प्रश्नात सर्वात जवळचा पर्याय निवडा.' },
  quizNote: { en: 'This is a field guide, not a lab result. A soil test gives the exact answer.', hi: 'यह खेत का अंदाज़ है, लैब रिपोर्ट नहीं। सही जवाब मिट्टी जाँच से मिलेगा।', mr: 'हा शेतातील अंदाज आहे, प्रयोगशाळेचा निकाल नाही. अचूक उत्तर माती परीक्षणातून मिळते.' },

  // --- Advice screen
  adviceDesc: { en: 'General steps, not doses. Your Soil Health Card or KVK gives the exact quantity for your crop.', hi: 'सामान्य कदम, मात्रा नहीं। सही मात्रा आपका मृदा स्वास्थ्य कार्ड या KVK बताएगा।', mr: 'सामान्य उपाय, प्रमाण नव्हे. नेमके प्रमाण तुमची मृदा आरोग्य पत्रिका किंवा KVK सांगेल.' },
  forSoilType: { en: 'For your soil type: {soil}', hi: 'आपकी मिट्टी के प्रकार के लिए: {soil}', mr: 'तुमच्या मातीच्या प्रकारासाठी: {soil}' },
  changeSoil: { en: 'Not right? Find my soil type', hi: 'सही नहीं? अपनी मिट्टी पहचानें', mr: 'बरोबर नाही? माझी माती ओळखा' },
  fromCard: { en: 'From your Soil Health Card', hi: 'आपके मृदा स्वास्थ्य कार्ड से', mr: 'तुमच्या मृदा आरोग्य पत्रिकेतून' },
  noCardYet: { en: 'No card values saved yet. Add them to get advice tuned to your soil.', hi: 'अभी कोई कार्ड मान सहेजे नहीं हैं। अपनी मिट्टी के अनुसार सलाह के लिए इन्हें जोड़ें।', mr: 'अजून पत्रिकेची मूल्ये जतन केलेली नाहीत. तुमच्या मातीनुसार सल्ल्यासाठी ती भरा.' },
  addCard: { en: 'Add Soil Health Card values', hi: 'मृदा स्वास्थ्य कार्ड के मान जोड़ें', mr: 'मृदा आरोग्य पत्रिकेची मूल्ये भरा' },
  editCard: { en: 'Edit card values', hi: 'कार्ड के मान बदलें', mr: 'पत्रिकेची मूल्ये बदला' },
  attnCount: { en: '{n} to work on', hi: '{n} पर काम करना है', mr: '{n} वर काम करायचे' },
  allFine: { en: 'Nothing urgent in your card. Keep adding organic matter, rotate crops and re-test every 2–3 years.', hi: 'आपके कार्ड में कुछ ज़रूरी नहीं। जैविक पदार्थ डालते रहें, फसल चक्र अपनाएँ और हर 2–3 साल में दोबारा जाँच करवाएँ।', mr: 'तुमच्या पत्रिकेत तातडीचे काही नाही. सेंद्रिय पदार्थ देत राहा, पिकांची फेरपालट करा आणि दर २–३ वर्षांनी पुन्हा चाचणी करा.' },
  plentyTitle: { en: 'Already plenty', hi: 'पहले से भरपूर', mr: 'आधीच भरपूर' },
  verifyNote: { en: 'Always confirm quantities and products with your local Krishi Vigyan Kendra (KVK) or agriculture officer before buying or applying anything.', hi: 'कुछ भी खरीदने या डालने से पहले मात्रा और उत्पाद अपने स्थानीय कृषि विज्ञान केंद्र (KVK) या कृषि अधिकारी से पक्का कर लें।', mr: 'काहीही खरेदी करण्यापूर्वी किंवा देण्यापूर्वी प्रमाण व उत्पादन तुमच्या स्थानिक कृषी विज्ञान केंद्र (KVK) किंवा कृषी अधिकाऱ्याकडून निश्चित करा.' },
  planCrops: { en: 'Plan crops for this soil', hi: 'इस मिट्टी के लिए फसल चुनें', mr: 'या मातीसाठी पीक निवडा' },

  // --- Where to get tested + Test history
  whereTitle: { en: "Where to get tested", hi: "जाँच कहाँ करवाएँ", mr: "चाचणी कुठे करावी" },
  whereBlurb: { en: "Take a sample, then find a government lab, KVK or private lab.", hi: "नमूना लें, फिर सरकारी लैब, KVK या निजी लैब खोजें।", mr: "नमुना घ्या, मग सरकारी प्रयोगशाळा, KVK किंवा खासगी प्रयोगशाळा शोधा." },
  whereDesc: { en: "Get your soil tested before you buy fertiliser. Here is how to take a sample and where to take it.", hi: "खाद खरीदने से पहले मिट्टी की जाँच करवाएँ। नमूना कैसे लें और कहाँ ले जाएँ, यहाँ देखें।", mr: "खत खरेदी करण्यापूर्वी माती तपासून घ्या. नमुना कसा घ्यायचा व कुठे न्यायचा ते येथे पहा." },
  whereRoutes: { en: "Three ways to get a test", hi: "जाँच करवाने के तीन तरीके", mr: "चाचणी करण्याचे तीन मार्ग" },
  route1Title: { en: "Government Soil Health Card", hi: "सरकारी मृदा स्वास्थ्य कार्ड", mr: "सरकारी मृदा आरोग्य पत्रिका" },
  route1Text: { en: "Under the Soil Health Card scheme, state agriculture staff collect samples and the government pays for collection and testing. Ask your village agriculture assistant or district agriculture office when sampling is happening, and confirm any charge locally.", hi: "मृदा स्वास्थ्य कार्ड योजना में राज्य कृषि विभाग के कर्मचारी नमूने लेते हैं और संग्रह व जाँच का खर्च सरकार उठाती है। नमूना कब लिया जा रहा है यह अपने ग्राम कृषि सहायक या ज़िला कृषि कार्यालय से पूछें, और कोई शुल्क हो तो स्थानीय स्तर पर पक्का करें।", mr: "मृदा आरोग्य पत्रिका योजनेत राज्य कृषी विभागाचे कर्मचारी नमुने घेतात आणि नमुना घेणे व चाचणीचा खर्च सरकार करते. नमुने कधी घेतले जात आहेत ते तुमच्या ग्राम कृषी सहायक किंवा जिल्हा कृषी कार्यालयाकडे विचारा आणि कोणतेही शुल्क असल्यास स्थानिक पातळीवर निश्चित करा." },
  route2Title: { en: "Krishi Vigyan Kendra (KVK)", hi: "कृषि विज्ञान केंद्र (KVK)", mr: "कृषी विज्ञान केंद्र (KVK)" },
  route2Text: { en: "Your district KVK can advise on sampling and tell you where to test. Some KVKs test soil themselves, so ask before you travel.", hi: "आपके ज़िले का KVK नमूना लेने की सलाह दे सकता है और बता सकता है कि जाँच कहाँ होगी। कुछ KVK खुद मिट्टी जाँचते हैं; जाने से पहले पूछ लें।", mr: "तुमच्या जिल्ह्याचे KVK नमुना घेण्याबाबत सल्ला देऊ शकते आणि चाचणी कुठे होईल ते सांगू शकते. काही KVK स्वतः माती तपासतात; जाण्यापूर्वी विचारून घ्या." },
  route3Title: { en: "University or private lab", hi: "विश्वविद्यालय या निजी लैब", mr: "विद्यापीठ किंवा खासगी प्रयोगशाळा" },
  route3Text: { en: "Agricultural universities and private labs test for a fee. Ask for the same 12 tests as the Soil Health Card (pH, EC, organic carbon, N, P, K, S, Zn, Fe, Cu, Mn, B) so you can enter the results here.", hi: "कृषि विश्वविद्यालय और निजी लैब शुल्क लेकर जाँच करते हैं। मृदा स्वास्थ्य कार्ड जैसी ही 12 जाँचें माँगें (pH, EC, जैविक कार्बन, N, P, K, S, Zn, Fe, Cu, Mn, B) ताकि नतीजे यहाँ भर सकें।", mr: "कृषी विद्यापीठे व खासगी प्रयोगशाळा शुल्क घेऊन चाचणी करतात. मृदा आरोग्य पत्रिकेप्रमाणेच १२ चाचण्या मागा (pH, EC, सेंद्रिय कर्ब, N, P, K, S, Zn, Fe, Cu, Mn, B) म्हणजे निकाल येथे भरता येतील." },
  sampleTitle: { en: "How to take a soil sample", hi: "मिट्टी का नमूना कैसे लें", mr: "मातीचा नमुना कसा घ्यावा" },
  sample1: { en: "When: after harvest and before sowing or fertiliser. Avoid wet soil and the weeks right after manure or fertiliser.", hi: "कब: कटाई के बाद और बुवाई या खाद डालने से पहले। गीली मिट्टी और खाद डालने के तुरंत बाद के हफ्तों से बचें।", mr: "केव्हा: काढणीनंतर व पेरणी किंवा खत देण्यापूर्वी. ओली माती आणि खत दिल्यानंतरचे लगेचचे आठवडे टाळा." },
  sample2: { en: "Where: walk across the field in a zigzag and sample 6–10 spots. Skip bunds, trees, compost heaps, water channels and wet patches.", hi: "कहाँ: खेत में टेढ़े-मेढ़े (ज़िगज़ैग) चलें और 6–10 जगहों से नमूना लें। मेड़, पेड़, कम्पोस्ट ढेर, पानी की नाली और गीली जगहें छोड़ें।", mr: "कुठे: शेतात नागमोडी चाला व ६–१० ठिकाणांहून नमुना घ्या. बांध, झाडे, कंपोस्टचे ढीग, पाण्याचे पाट व ओली जागा टाळा." },
  sample3: { en: "How: clear the surface litter, dig a V-shaped pit 15–20 cm deep, and cut a thin slice of soil from the top to the bottom of one side.", hi: "कैसे: ऊपर का कचरा हटाएँ, 15–20 सेमी गहरा V आकार का गड्ढा खोदें और एक तरफ़ से ऊपर से नीचे तक मिट्टी की पतली परत काटें।", mr: "कसे: वरचा कचरा बाजूला करा, १५–२० सेंमी खोल V आकाराचा खड्डा खणा आणि एका बाजूने वरून खालपर्यंत मातीचा पातळ थर कापा." },
  sample4: { en: "Mix: put all slices on a clean cloth or plastic sheet, mix well, then keep about half a kilo. Use clean tools, not ones used for fertiliser.", hi: "मिलाएँ: सारी परतें साफ़ कपड़े या प्लास्टिक पर रखकर अच्छी तरह मिलाएँ, फिर लगभग आधा किलो रखें। साफ़ औज़ार लें, खाद वाले नहीं।", mr: "मिसळा: सर्व थर स्वच्छ कापडावर किंवा प्लास्टिकवर टाका, नीट मिसळा व सुमारे अर्धा किलो ठेवा. स्वच्छ अवजारे वापरा, खतासाठी वापरलेली नको." },
  sample5: { en: "Label: dry it in shade, put it in a clean bag, and write your name, survey number, date, last crop and the crop you plan. Use one sample per field.", hi: "लेबल: छाँव में सुखाएँ, साफ़ थैली में रखें और अपना नाम, सर्वे नंबर, तारीख, पिछली फसल और अगली फसल लिखें। हर खेत का अलग नमूना लें।", mr: "लेबल: सावलीत वाळवा, स्वच्छ पिशवीत ठेवा आणि तुमचे नाव, गट/सर्वे क्रमांक, तारीख, मागील पीक व पुढील नियोजित पीक लिहा. प्रत्येक शेताचा वेगळा नमुना घ्या." },
  helpTitle: { en: "Find help near you", hi: "अपने पास मदद खोजें", mr: "तुमच्या जवळ मदत शोधा" },
  linkPortal: { en: "Soil Health Card portal", hi: "मृदा स्वास्थ्य कार्ड पोर्टल", mr: "मृदा आरोग्य पत्रिका पोर्टल" },
  linkPortalSub: { en: "Track your sample, print your card, find a lab", hi: "अपना नमूना ट्रैक करें, कार्ड प्रिंट करें, लैब खोजें", mr: "तुमचा नमुना ट्रॅक करा, पत्रिका छापा, प्रयोगशाळा शोधा" },
  linkKvk: { en: "Find your KVK", hi: "अपना KVK खोजें", mr: "तुमचे KVK शोधा" },
  linkKvkSub: { en: "ICAR portal: search by state and district", hi: "ICAR पोर्टल: राज्य और ज़िले से खोजें", mr: "ICAR पोर्टल: राज्य व जिल्ह्यानुसार शोधा" },
  linkMaps: { en: "Soil testing labs on the map", hi: "नक्शे पर मिट्टी जाँच लैब", mr: "नकाशावर माती परीक्षण प्रयोगशाळा" },
  linkMapsSub: { en: "Opens a Google Maps search", hi: "Google Maps खोज खुलेगी", mr: "Google Maps शोध उघडेल" },
  linkCall: { en: "Kisan Call Centre: 1800-180-1551", hi: "किसान कॉल सेंटर: 1800-180-1551", mr: "किसान कॉल सेंटर: 1800-180-1551" },
  linkCallSub: { en: "Toll-free, 6 am to 10 pm", hi: "टोल-फ्री, सुबह 6 से रात 10 बजे", mr: "टोल-फ्री, सकाळी ६ ते रात्री १०" },
  helpNote: { en: "KrishiGuide does not list labs itself. These buttons open official sites or a map search, so check timings and charges before you go.", hi: "KrishiGuide खुद लैब की सूची नहीं देता। ये बटन सरकारी साइट या नक्शे की खोज खोलते हैं, इसलिए जाने से पहले समय और शुल्क पूछ लें।", mr: "KrishiGuide स्वतः प्रयोगशाळांची यादी देत नाही. ही बटणे अधिकृत संकेतस्थळे किंवा नकाशा शोध उघडतात, म्हणून जाण्यापूर्वी वेळ व शुल्क विचारा." },
  carryTitle: { en: "Take with you", hi: "साथ ले जाएँ", mr: "सोबत घ्या" },
  carryText: { en: "Your labelled sample, survey number or land record, your mobile number, and a note of the crop you plan to grow.", hi: "लेबल लगा नमूना, सर्वे नंबर या ज़मीन का रिकॉर्ड, मोबाइल नंबर, और अगली फसल का नोट।", mr: "लेबल लावलेला नमुना, गट/सर्वे क्रमांक किंवा जमिनीचा उतारा, मोबाइल क्रमांक आणि घेणार असलेल्या पिकाची नोंद." },
  gotReport: { en: "Got your report? Enter it here", hi: "रिपोर्ट मिल गई? यहाँ भरें", mr: "अहवाल मिळाला? येथे भरा" },
  chipGuide: { en: "Guide + official links", hi: "गाइड + सरकारी लिंक", mr: "मार्गदर्शक + अधिकृत दुवे" },
  histTitle: { en: "Test history", hi: "जाँच का इतिहास", mr: "चाचणी इतिहास" },
  histBlurb: { en: "Keep every test result and see if your soil is improving.", hi: "हर जाँच का नतीजा रखें और देखें कि मिट्टी सुधर रही है या नहीं।", mr: "प्रत्येक चाचणीचा निकाल ठेवा आणि माती सुधारते आहे का ते पहा." },
  histDesc: { en: "Each time you save a Soil Health Card it is kept here. Everything stays on this device.", hi: "हर बार कार्ड सहेजने पर वह यहाँ रखा जाता है। सब कुछ इसी डिवाइस पर रहता है।", mr: "प्रत्येक वेळी पत्रिका जतन केल्यावर ती येथे ठेवली जाते. सर्व काही याच डिव्हाइसवर राहते." },
  histEmpty: { en: "No saved tests yet. Save a Soil Health Card and it will appear here.", hi: "अभी कोई जाँच सहेजी नहीं है। मृदा स्वास्थ्य कार्ड सहेजें, वह यहाँ दिखेगा।", mr: "अजून कोणतीही चाचणी जतन केलेली नाही. मृदा आरोग्य पत्रिका जतन करा, ती येथे दिसेल." },
  histAdd: { en: "Add a new test result", hi: "नई जाँच का नतीजा जोड़ें", mr: "नवीन चाचणी निकाल जोडा" },
  histCompare: { en: "Is it improving?", hi: "क्या सुधार हो रहा है?", mr: "सुधारणा होत आहे का?" },
  histCompareSub: { en: "Your latest test compared with the one before it.", hi: "आपकी ताज़ा जाँच की पिछली जाँच से तुलना।", mr: "तुमच्या ताज्या चाचणीची आधीच्या चाचणीशी तुलना." },
  histNeedTwo: { en: "Save a second test to see how your soil is changing.", hi: "मिट्टी में बदलाव देखने के लिए दूसरी जाँच सहेजें।", mr: "माती कशी बदलते आहे ते पाहण्यासाठी दुसरी चाचणी जतन करा." },
  better: { en: "Better", hi: "बेहतर", mr: "चांगले" },
  worse: { en: "Worse", hi: "बदतर", mr: "वाईट" },
  sameRating: { en: "Same rating", hi: "वही रेटिंग", mr: "तीच श्रेणी" },
  histAll: { en: "All saved tests", hi: "सभी सहेजी जाँचें", mr: "सर्व जतन केलेल्या चाचण्या" },
  histUntitled: { en: "Soil test", hi: "मिट्टी जाँच", mr: "माती चाचणी" },
  allFineShort: { en: "All fine", hi: "सब ठीक", mr: "सर्व ठीक" },
  histDelete: { en: "Delete", hi: "हटाएँ", mr: "काढा" },
  histConfirm: { en: "Delete this saved test?", hi: "यह सहेजी गई जाँच हटाएँ?", mr: "ही जतन केलेली चाचणी काढायची?" },
  histDeleted: { en: "Test deleted", hi: "जाँच हटाई गई", mr: "चाचणी काढली" },
  chipHistNone: { en: "No tests yet", hi: "अभी कोई जाँच नहीं", mr: "अजून चाचणी नाही" },
  chipHist1: { en: "1 test saved", hi: "1 जाँच सहेजी", mr: "१ चाचणी जतन" },
  chipHistN: { en: "{n} tests saved", hi: "{n} जाँचें सहेजी", mr: "{n} चाचण्या जतन" },
};

// ------------------------------------------------------------------ Soil Health Card parameters
// min/max are plausibility limits for input validation, not agronomic limits.
export const PARAMS = [
  { id: 'ph', group: 'main', unit: '', min: 3, max: 11, step: '0.1', eg: '7.2',
    name: { en: 'Soil pH', hi: 'मिट्टी का pH', mr: 'मातीचा pH' },
    what: { en: 'pH shows if soil is acidic or alkaline. Most crops grow best near neutral (about 6.5–7.5).', hi: 'pH बताता है कि मिट्टी अम्लीय है या क्षारीय। ज़्यादातर फसलें लगभग सामान्य pH (6.5–7.5) में अच्छी उगती हैं।', mr: 'pH वरून माती आम्लयुक्त की क्षारयुक्त ते कळते. बहुतेक पिके साधारण pH (६.५–७.५) मध्ये चांगली येतात.' } },
  { id: 'ec', group: 'main', unit: 'dS/m', min: 0, max: 25, step: '0.01', eg: '0.4',
    name: { en: 'Salt level (EC)', hi: 'लवणता (EC)', mr: 'क्षारांचे प्रमाण (EC)' },
    what: { en: 'EC measures soluble salts. Too much salt stops seeds from sprouting and roots from taking up water.', hi: 'EC घुलनशील लवण मापता है। ज़्यादा लवण से बीज अंकुरित नहीं होते और जड़ें पानी नहीं ले पातीं।', mr: 'EC म्हणजे जमिनीतील विरघळणारे क्षार. क्षार जास्त असतील तर बियाणे उगवत नाही आणि मुळांना पाणी घेता येत नाही.' } },
  { id: 'oc', group: 'main', unit: '%', min: 0, max: 5, step: '0.01', eg: '0.6',
    name: { en: 'Organic carbon (OC)', hi: 'जैविक कार्बन (OC)', mr: 'सेंद्रिय कर्ब (OC)' },
    what: { en: 'Organic carbon shows how much living, decaying matter the soil holds. It keeps soil soft, moist and fertile.', hi: 'जैविक कार्बन बताता है कि मिट्टी में कितना सड़ा-गला जैविक पदार्थ है। यह मिट्टी को भुरभुरी, नम और उपजाऊ रखता है।', mr: 'सेंद्रिय कर्ब म्हणजे मातीतील कुजलेल्या सेंद्रिय पदार्थांचे प्रमाण. त्यामुळे माती भुसभुशीत, ओलसर आणि सुपीक राहते.' } },
  { id: 'n', group: 'main', unit: 'kg/ha', min: 0, max: 2000, step: '1', eg: '250',
    name: { en: 'Nitrogen (N)', hi: 'नाइट्रोजन (N)', mr: 'नत्र (N)' },
    what: { en: 'Nitrogen drives leaf and shoot growth. It is the green in the crop.', hi: 'नाइट्रोजन पत्तियों और तनों की बढ़त के लिए ज़रूरी है। फसल का हरापन इसी से है।', mr: 'नत्रामुळे पाने व फांद्यांची वाढ होते. पिकाचा हिरवेपणा त्यावर अवलंबून असतो.' } },
  { id: 'p', group: 'main', unit: 'kg/ha', min: 0, max: 500, step: '0.1', eg: '14',
    name: { en: 'Phosphorus (P)', hi: 'फॉस्फोरस (P)', mr: 'स्फुरद (P)' },
    what: { en: 'Phosphorus helps roots, flowering and grain or pod setting.', hi: 'फॉस्फोरस जड़ों, फूल आने और दाने/फली बनने में मदद करता है।', mr: 'स्फुरदामुळे मुळे, फुले व दाणे/शेंगा धरण्यास मदत होते.' } },
  { id: 'k', group: 'main', unit: 'kg/ha', min: 0, max: 3000, step: '1', eg: '200',
    name: { en: 'Potassium (K)', hi: 'पोटाश (K)', mr: 'पालाश (K)' },
    what: { en: 'Potassium helps plants stand up to drought, pests and disease, and improves grain and fruit quality.', hi: 'पोटाश पौधे को सूखे, कीट और रोग से लड़ने की ताकत देता है और दाने/फल की गुणवत्ता बढ़ाता है।', mr: 'पालाशमुळे पिकाची दुष्काळ, कीड व रोगांविरुद्ध प्रतिकारशक्ती वाढते आणि दाणे/फळांची प्रत सुधारते.' } },
  { id: 's', group: 'micro', unit: 'ppm', min: 0, max: 300, step: '0.1', eg: '12',
    name: { en: 'Sulphur (S)', hi: 'सल्फर (S)', mr: 'गंधक (S)' },
    what: { en: 'Sulphur is vital for oilseeds and pulses. It builds protein and oil.', hi: 'सल्फर तिलहन और दलहन के लिए खास ज़रूरी है। यह प्रोटीन और तेल बनाता है।', mr: 'गंधक तेलबिया व कडधान्यांसाठी महत्त्वाचा आहे. तो प्रथिने व तेल तयार करण्यास मदत करतो.' } },
  { id: 'zn', group: 'micro', unit: 'ppm', min: 0, max: 50, step: '0.01', eg: '0.8',
    name: { en: 'Zinc (Zn)', hi: 'जिंक (Zn)', mr: 'जस्त (Zn)' },
    what: { en: 'Zinc is needed in tiny amounts for growth. A shortage shows as stunted plants.', hi: 'जिंक बहुत कम मात्रा में चाहिए और बढ़त के लिए ज़रूरी है। कमी से पौधे बौने रहते हैं।', mr: 'जस्त अगदी थोड्या प्रमाणात लागते आणि वाढीसाठी आवश्यक आहे. कमतरतेमुळे झाडे खुरटतात.' } },
  { id: 'fe', group: 'micro', unit: 'ppm', min: 0, max: 200, step: '0.01', eg: '5',
    name: { en: 'Iron (Fe)', hi: 'आयरन (Fe)', mr: 'लोह (Fe)' },
    what: { en: 'Iron makes chlorophyll. A shortage turns young leaves yellow.', hi: 'आयरन क्लोरोफिल बनाता है। कमी से नई पत्तियाँ पीली पड़ जाती हैं।', mr: 'लोह हरितद्रव्य तयार करते. कमी असेल तर कोवळी पाने पिवळी पडतात.' } },
  { id: 'cu', group: 'micro', unit: 'ppm', min: 0, max: 50, step: '0.01', eg: '0.4',
    name: { en: 'Copper (Cu)', hi: 'कॉपर (Cu)', mr: 'तांबे (Cu)' },
    what: { en: 'Copper helps plants use other nutrients and resist disease.', hi: 'कॉपर पौधे को अन्य पोषक तत्व लेने और रोग से बचाव में मदद करता है।', mr: 'तांब्यामुळे पिकाला इतर अन्नद्रव्ये घेण्यास व रोगांना तोंड देण्यास मदत होते.' } },
  { id: 'mn', group: 'micro', unit: 'ppm', min: 0, max: 200, step: '0.01', eg: '3',
    name: { en: 'Manganese (Mn)', hi: 'मैंगनीज़ (Mn)', mr: 'मँगनीज (Mn)' },
    what: { en: 'Manganese supports photosynthesis and seed formation.', hi: 'मैंगनीज़ प्रकाश-संश्लेषण और बीज बनने में सहायक है।', mr: 'मँगनीजमुळे प्रकाशसंश्लेषण व बीजधारणा होण्यास मदत होते.' } },
  { id: 'b', group: 'micro', unit: 'ppm', min: 0, max: 20, step: '0.01', eg: '0.6',
    name: { en: 'Boron (B)', hi: 'बोरॉन (B)', mr: 'बोरॉन (B)' },
    what: { en: 'Boron helps flowering, fruit set and seed formation. The safe range is narrow.', hi: 'बोरॉन फूल, फल और बीज बनने में मदद करता है। इसकी सुरक्षित सीमा बहुत संकरी है।', mr: 'बोरॉनमुळे फुले, फळधारणा व बीजधारणा होते. त्याचे सुरक्षित प्रमाण फार मर्यादित असते.' } },
];

// Critical limits (ppm) below which a micronutrient is treated as deficient.
const MICRO_LIMIT = { zn: 0.6, fe: 4.5, cu: 0.2, mn: 2.0, b: 0.5 };

// Returns a status key for a numeric value. Statuses are globally unique so one table can label them.
export function rateParam(id, v) {
  switch (id) {
    case 'ph': return v < 5.5 ? 'strong_acid' : v < 6.5 ? 'acid' : v <= 7.5 ? 'neutral' : v <= 8.5 ? 'alkaline' : 'strong_alkaline';
    case 'ec': return v < 1 ? 'normal' : v <= 3 ? 'elevated' : 'very_high';
    case 'oc': return v < 0.5 ? 'low' : v <= 0.75 ? 'medium' : 'high';
    case 'n': return v < 280 ? 'low' : v <= 560 ? 'medium' : 'high';
    case 'p': return v < 11 ? 'low' : v <= 25 ? 'medium' : 'high';
    case 'k': return v < 110 ? 'low' : v <= 280 ? 'medium' : 'high';
    case 's': return v < 10 ? 'low' : v <= 20 ? 'medium' : 'high';
    default: return v < MICRO_LIMIT[id] ? 'deficient' : 'enough';
  }
}

export const TONE = {
  low: 'bad', medium: 'good', high: 'good', deficient: 'bad', enough: 'good',
  strong_acid: 'bad', acid: 'watch', neutral: 'good', alkaline: 'watch', strong_alkaline: 'bad',
  normal: 'good', elevated: 'watch', very_high: 'bad',
};
export const TONE_RANK = { bad: 0, watch: 1, good: 2 };

export const STATUS_LABEL = {
  low: { en: 'Low', hi: 'कम', mr: 'कमी' },
  medium: { en: 'Medium', hi: 'मध्यम', mr: 'मध्यम' },
  high: { en: 'High', hi: 'अधिक', mr: 'जास्त' },
  deficient: { en: 'Low (deficient)', hi: 'कम (कमी)', mr: 'कमी (अभाव)' },
  enough: { en: 'Enough', hi: 'पर्याप्त', mr: 'पुरेसे' },
  strong_acid: { en: 'Strongly acidic', hi: 'बहुत अम्लीय', mr: 'तीव्र आम्लयुक्त' },
  acid: { en: 'Slightly acidic', hi: 'हल्की अम्लीय', mr: 'सौम्य आम्लयुक्त' },
  neutral: { en: 'Neutral (good)', hi: 'सामान्य (अच्छा)', mr: 'उदासीन (योग्य)' },
  alkaline: { en: 'Alkaline', hi: 'क्षारीय', mr: 'क्षारयुक्त' },
  strong_alkaline: { en: 'Strongly alkaline', hi: 'बहुत क्षारीय', mr: 'तीव्र क्षारयुक्त' },
  normal: { en: 'Normal', hi: 'सामान्य', mr: 'सामान्य' },
  elevated: { en: 'High: watch sensitive crops', hi: 'अधिक: संवेदनशील फसलों पर ध्यान', mr: 'जास्त: नाजूक पिकांकडे लक्ष' },
  very_high: { en: 'Very high (salty)', hi: 'बहुत अधिक (खारी)', mr: 'खूप जास्त (खारट)' },
};

// Plain-language "what this rating means", one sentence per status.
export const MEANING = {
  low: { en: 'Low: the soil may not supply enough for a good crop. See the advice section.', hi: 'कम: मिट्टी अच्छी फसल के लिए पर्याप्त नहीं दे पाएगी। सलाह वाला भाग देखें।', mr: 'कमी: चांगल्या पिकासाठी माती पुरेसे देऊ शकणार नाही. सल्ला विभाग पहा.' },
  medium: { en: 'Medium: enough for most crops. Keep it up with manure and crop rotation.', hi: 'मध्यम: ज़्यादातर फसलों के लिए पर्याप्त। खाद और फसल चक्र से बनाए रखें।', mr: 'मध्यम: बहुतेक पिकांसाठी पुरेसे. शेणखत व फेरपालटीने टिकवा.' },
  high: { en: 'High: plenty available. You may not need to add more this season.', hi: 'अधिक: भरपूर उपलब्ध। इस मौसम में शायद और डालने की ज़रूरत नहीं।', mr: 'जास्त: भरपूर उपलब्ध. या हंगामात अधिक देण्याची गरज नसेल.' },
  deficient: { en: 'Deficient: crops may show stunting or yellowing. Correct only as recommended.', hi: 'कमी: फसल में बौनापन या पीलापन दिख सकता है। केवल सिफारिश के अनुसार ही सुधारें।', mr: 'कमतरता: पिकात खुरटलेपणा किंवा पिवळेपणा दिसू शकतो. फक्त शिफारशीनुसारच सुधारणा करा.' },
  enough: { en: 'Enough: no correction needed now.', hi: 'पर्याप्त: अभी सुधार की ज़रूरत नहीं।', mr: 'पुरेसे: आता सुधारणा नको.' },
  strong_acid: { en: 'Too acidic: roots and nutrient uptake suffer. Needs correction. See the advice section.', hi: 'बहुत अम्लीय: जड़ों और पोषक तत्वों के अवशोषण पर असर। सुधार ज़रूरी। सलाह देखें।', mr: 'खूप आम्लयुक्त: मुळे व अन्नद्रव्य शोषणावर परिणाम. सुधारणा आवश्यक. सल्ला पहा.' },
  acid: { en: 'Slightly acidic: fine for many crops. Keep an eye on it.', hi: 'हल्की अम्लीय: कई फसलों के लिए ठीक। नज़र रखें।', mr: 'सौम्य आम्लयुक्त: अनेक पिकांसाठी ठीक. लक्ष ठेवा.' },
  neutral: { en: 'Neutral: the best range for most crops.', hi: 'सामान्य: ज़्यादातर फसलों के लिए सबसे अच्छा।', mr: 'उदासीन: बहुतेक पिकांसाठी सर्वोत्तम.' },
  alkaline: { en: 'Alkaline: some nutrients (iron, zinc) get locked up. See the advice section.', hi: 'क्षारीय: कुछ पोषक तत्व (आयरन, जिंक) बंध जाते हैं। सलाह देखें।', mr: 'क्षारयुक्त: काही अन्नद्रव्ये (लोह, जस्त) बांधली जातात. सल्ला पहा.' },
  strong_alkaline: { en: 'Strongly alkaline: often sodic, hard and poorly draining. Needs a plan. See the advice section.', hi: 'बहुत क्षारीय: प्रायः सोडिक, कठोर और जल निकास कमज़ोर। योजना चाहिए। सलाह देखें।', mr: 'खूप क्षारयुक्त: अनेकदा चोपण, कडक व निचरा कमी. नियोजन हवे. सल्ला पहा.' },
  normal: { en: 'Normal: salts are not a problem.', hi: 'सामान्य: लवण की समस्या नहीं।', mr: 'सामान्य: क्षारांची अडचण नाही.' },
  elevated: { en: 'High: sensitive crops and germination can suffer. Watch irrigation water and drainage.', hi: 'अधिक: संवेदनशील फसल और अंकुरण प्रभावित हो सकते हैं। सिंचाई का पानी और जल निकास देखें।', mr: 'जास्त: नाजूक पिके व उगवण बाधित होऊ शकते. सिंचनाचे पाणी व निचरा तपासा.' },
  very_high: { en: 'Very high: salty soil, most crops will struggle. Needs a reclamation plan.', hi: 'बहुत अधिक: खारी मिट्टी, ज़्यादातर फसलें कठिनाई में। सुधार योजना चाहिए।', mr: 'खूप जास्त: खारट माती, बहुतेक पिकांना अडचण. सुधारणा आराखडा हवा.' },
};

// Rate every filled value. Empty / non-numeric entries are skipped.
export function assess(values) {
  const out = [];
  for (const p of PARAMS) {
    const raw = values ? values[p.id] : undefined;
    if (raw === '' || raw == null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const status = rateParam(p.id, v);
    out.push({ id: p.id, value: v, status, tone: TONE[status] });
  }
  return out;
}

export function isValidValue(id, raw) {
  const p = PARAMS.find((x) => x.id === id);
  const v = Number(raw);
  return Boolean(p) && String(raw).trim() !== '' && Number.isFinite(v) && v >= p.min && v <= p.max;
}

// Compare one parameter between two tests. TONE_RANK is higher = healthier, so a move up a
// rank is "better", down is "worse", and staying in the same rating band is "same".
export function compareValues(id, prev, next) {
  const a = TONE_RANK[TONE[rateParam(id, Number(prev))]];
  const b = TONE_RANK[TONE[rateParam(id, Number(next))]];
  return b > a ? 'better' : b < a ? 'worse' : 'same';
}

// ------------------------------------------------------------------ Fertilizer & amendment advice
const FOLLOW_CARD = {
  en: 'Use the quantity written on your Soil Health Card or given by your KVK for your crop. Do not guess.',
  hi: 'अपनी फसल के लिए मृदा स्वास्थ्य कार्ड पर लिखी या KVK की बताई मात्रा ही डालें। अंदाज़े से नहीं।',
  mr: 'तुमच्या पिकासाठी मृदा आरोग्य पत्रिकेवरील किंवा KVK ने सांगितलेले प्रमाणच वापरा. अंदाजाने नको.',
};

const ACID_STEPS = [
  { en: 'Agricultural lime is the usual fix for acid soil. The quantity depends on a lab lime-requirement test, so get one before buying.', hi: 'अम्लीय मिट्टी में आमतौर पर कृषि चूना डाला जाता है। मात्रा लैब के चूना-आवश्यकता परीक्षण पर निर्भर है, खरीदने से पहले यह जाँच करवाएँ।', mr: 'आम्लयुक्त जमिनीत सहसा कृषी चुना वापरतात. प्रमाण प्रयोगशाळेतील चुना-गरज चाचणीवर ठरते; खरेदीपूर्वी ती चाचणी करून घ्या.' },
  { en: 'Mix well-rotted compost or farmyard manure into the soil. It helps hold pH steady.', hi: 'अच्छी सड़ी कम्पोस्ट या गोबर की खाद मिट्टी में मिलाएँ। इससे pH संतुलित रहता है।', mr: 'चांगले कुजलेले कंपोस्ट किंवा शेणखत मातीत मिसळा. त्यामुळे pH संतुलित राहतो.' },
  { en: 'Until it is corrected, pick crops that tolerate acidity and ask your KVK for suitable varieties.', hi: 'सुधार होने तक अम्लता सहने वाली फसलें चुनें और KVK से उपयुक्त किस्में पूछें।', mr: 'सुधारणा होईपर्यंत आम्लता सहन करणारी पिके निवडा आणि योग्य वाणांसाठी KVK ला विचारा.' },
];
const ALKALINE_STEPS = [
  { en: 'Add compost, farmyard manure or green manure every season. It improves soil structure and softens the effect of high pH.', hi: 'हर मौसम में कम्पोस्ट, गोबर की खाद या हरी खाद डालें। इससे मिट्टी की बनावट सुधरती है और ऊँचे pH का असर घटता है।', mr: 'दर हंगामात कंपोस्ट, शेणखत किंवा हिरवळीचे खत द्या. त्यामुळे मातीची रचना सुधारते व जास्त pH चा परिणाम कमी होतो.' },
  { en: 'Gypsum is used on sodic soils (hard, water stands, high pH). Use it only after a test confirms sodicity and tells you how much.', hi: 'जिप्सम चोपन (सोडिक) मिट्टी में काम आता है (कठोर, पानी रुकता है, pH ऊँचा)। जाँच से सोडिक होना और मात्रा पता चलने के बाद ही डालें।', mr: 'जिप्सम चोपण (सोडिक) जमिनीत वापरतात (कडक, पाणी साचते, pH जास्त). चाचणीने चोपणपणा व प्रमाण निश्चित झाल्यावरच वापरा.' },
  { en: 'Where your KVK advises, sulphur-containing fertilisers such as single super phosphate can suit alkaline soil. Watch for iron and zinc shortage.', hi: 'जहाँ KVK सलाह दे, वहाँ सिंगल सुपर फॉस्फेट जैसे सल्फर वाले उर्वरक क्षारीय मिट्टी में उपयुक्त हो सकते हैं। आयरन और जिंक की कमी पर नज़र रखें।', mr: 'KVK ने सुचवल्यास सिंगल सुपर फॉस्फेटसारखी गंधकयुक्त खते क्षारयुक्त जमिनीला योग्य ठरू शकतात. लोह व जस्ताच्या कमतरतेवर लक्ष ठेवा.' },
];
const MICRO_STEPS = [
  { en: 'Correct it only with the quantity your card or KVK recommends. Micronutrients are needed in tiny amounts and too much can harm the crop.', hi: 'केवल उतनी मात्रा डालें जो कार्ड या KVK सुझाए। सूक्ष्म पोषक तत्व बहुत कम चाहिए और ज़्यादा डालने से फसल को नुकसान हो सकता है।', mr: 'फक्त पत्रिका किंवा KVK ने सुचवलेले प्रमाणच द्या. सूक्ष्म अन्नद्रव्ये अगदी थोडी लागतात आणि जास्त दिल्यास पिकाला हानी होऊ शकते.' },
  { en: 'Organic manure helps keep micronutrients available to the crop.', hi: 'जैविक खाद सूक्ष्म पोषक तत्वों को फसल के लिए उपलब्ध रखने में मदद करती है।', mr: 'सेंद्रिय खतामुळे सूक्ष्म अन्नद्रव्ये पिकाला उपलब्ध राहतात.' },
];

export const ADVICE = {
  acid: { steps: ACID_STEPS },
  alkaline: { steps: ALKALINE_STEPS },
  strong_alkaline: { steps: [...ALKALINE_STEPS, { en: 'Good drainage and good-quality irrigation water are essential. Meet your KVK soon: reclaiming strongly alkaline land needs a plan.', hi: 'अच्छा जल निकास और अच्छी गुणवत्ता का सिंचाई पानी ज़रूरी है। जल्द KVK से मिलें: बहुत क्षारीय ज़मीन का सुधार योजना से होता है।', mr: 'चांगला निचरा व चांगल्या प्रतीचे सिंचनाचे पाणी आवश्यक. लवकर KVK ला भेटा: खूप क्षारयुक्त जमीन सुधारण्यासाठी आराखडा लागतो.' }] },
  salt: { steps: [
    { en: 'Improve drainage and avoid waterlogging. Salts rise to the surface where water stands and dries.', hi: 'जल निकास सुधारें और जलभराव से बचें। जहाँ पानी रुककर सूखता है वहाँ लवण ऊपर आ जाते हैं।', mr: 'निचरा सुधारा व पाणी साचू देऊ नका. जिथे पाणी साचून वाळते तिथे क्षार वर येतात.' },
    { en: 'Get your irrigation water tested too. Salty water adds to the problem.', hi: 'सिंचाई के पानी की भी जाँच कराएँ। खारा पानी समस्या बढ़ाता है।', mr: 'सिंचनाच्या पाण्याचीही तपासणी करा. खारट पाणी समस्या वाढवते.' },
    { en: 'Add organic matter and choose salt-tolerant crops or varieties. Ask your KVK which suit your area.', hi: 'जैविक पदार्थ डालें और लवण सहने वाली फसलें/किस्में चुनें। अपने क्षेत्र के लिए KVK से पूछें।', mr: 'सेंद्रिय पदार्थ द्या आणि क्षार सहन करणारी पिके/वाण निवडा. तुमच्या भागासाठी KVK ला विचारा.' },
  ] },
  oc: { action: 'rotation', steps: [
    { en: 'Add compost or farmyard manure every season, and return crop residue to the field instead of burning it.', hi: 'हर मौसम में कम्पोस्ट या गोबर की खाद डालें, और फसल अवशेष जलाने के बजाय खेत में लौटाएँ।', mr: 'दर हंगामात कंपोस्ट किंवा शेणखत द्या आणि पिकाचे अवशेष जाळण्याऐवजी शेतातच मिसळा.' },
    { en: 'Where the season allows, grow a green-manure crop such as sunn hemp or dhaincha before the main crop.', hi: 'मौसम अनुमति दे तो मुख्य फसल से पहले सनई या ढैंचा जैसी हरी खाद की फसल उगाएँ।', mr: 'हंगाम परवानगी देत असेल तर मुख्य पिकापूर्वी ताग किंवा धैंचा यांसारखे हिरवळीचे खत पीक घ्या.' },
    { en: 'Mulch the soil surface and include legumes in your rotation.', hi: 'मिट्टी पर मल्च बिछाएँ और फसल चक्र में दलहन शामिल करें।', mr: 'मातीवर आच्छादन करा आणि फेरपालटीत कडधान्ये घ्या.' },
  ] },
  n: { action: 'rotation', steps: [
    { en: 'Include a legume (soybean, chickpea, moong) in your rotation. It fixes nitrogen for the next crop.', hi: 'फसल चक्र में दलहन (सोयाबीन, चना, मूँग) शामिल करें। यह अगली फसल के लिए नाइट्रोजन बनाता है।', mr: 'फेरपालटीत कडधान्य (सोयाबीन, हरभरा, मूग) घ्या. ते पुढील पिकासाठी नत्र स्थिर करते.' },
    { en: 'Add organic manure, and give nitrogen fertiliser in split doses as per the crop schedule instead of all at once. This reduces loss.', hi: 'जैविक खाद डालें और नाइट्रोजन उर्वरक फसल के कार्यक्रम के अनुसार किश्तों में दें, एक साथ नहीं। इससे नुकसान कम होता है।', mr: 'सेंद्रिय खत द्या आणि नत्रयुक्त खत पिकाच्या वेळापत्रकानुसार हप्त्याहप्त्याने द्या, एकदम नको. त्यामुळे नुकसान कमी होते.' },
    FOLLOW_CARD,
  ] },
  p: { steps: [
    { en: 'Apply phosphorus fertiliser at sowing, placed near the seed or root zone, as your Soil Health Card or KVK recommends.', hi: 'फॉस्फोरस उर्वरक बुवाई के समय बीज/जड़ क्षेत्र के पास डालें, जैसा मृदा स्वास्थ्य कार्ड या KVK सुझाए।', mr: 'स्फुरदयुक्त खत पेरणीवेळी बियाणे/मुळांच्या जवळ द्या, मृदा आरोग्य पत्रिका किंवा KVK सांगेल त्याप्रमाणे.' },
    { en: 'Organic manure and phosphate-solubilising biofertiliser (PSB) are widely advised to make soil phosphorus more available. Ask your KVK.', hi: 'मिट्टी का फॉस्फोरस उपलब्ध कराने के लिए जैविक खाद और फॉस्फेट-घुलनशील जैव उर्वरक (PSB) की सलाह व्यापक रूप से दी जाती है। KVK से पूछें।', mr: 'मातीतील स्फुरद उपलब्ध होण्यासाठी सेंद्रिय खत व स्फुरद विरघळवणारे जैविक खत (PSB) यांची शिफारस केली जाते. KVK ला विचारा.' },
    FOLLOW_CARD,
  ] },
  k: { steps: [
    { en: 'Apply potash fertiliser in the amount your Soil Health Card or KVK recommends for the crop. It matters especially for sugarcane, cotton, onion, banana and potato.', hi: 'पोटाश उर्वरक उतनी मात्रा में डालें जितनी मृदा स्वास्थ्य कार्ड या KVK फसल के लिए सुझाए। गन्ना, कपास, प्याज, केला और आलू के लिए यह खास ज़रूरी है।', mr: 'पालाशयुक्त खत मृदा आरोग्य पत्रिका किंवा KVK ने पिकासाठी सुचवलेल्या प्रमाणात द्या. ऊस, कापूस, कांदा, केळी व बटाटा यासाठी ते विशेष महत्त्वाचे आहे.' },
    { en: 'Farmyard manure and returning crop residue also put potassium back in the soil.', hi: 'गोबर की खाद और फसल अवशेष लौटाने से भी मिट्टी में पोटाश वापस जाता है।', mr: 'शेणखत व पिकाचे अवशेष शेतात मिसळल्यानेही मातीत पालाश परत जाते.' },
    FOLLOW_CARD,
  ] },
  s: { steps: [
    { en: 'Sulphur-containing fertilisers such as single super phosphate, or gypsum where suitable, can supply it. Oilseeds and pulses respond most.', hi: 'सिंगल सुपर फॉस्फेट जैसे सल्फर वाले उर्वरक, या उपयुक्त जगह जिप्सम, सल्फर दे सकते हैं। तिलहन और दलहन में सबसे ज़्यादा असर दिखता है।', mr: 'सिंगल सुपर फॉस्फेटसारखी गंधकयुक्त खते, किंवा योग्य ठिकाणी जिप्सम, गंधक देऊ शकतात. तेलबिया व कडधान्यांना सर्वाधिक फायदा होतो.' },
    FOLLOW_CARD,
  ] },
  zn: { steps: [
    { en: 'Zinc sulphate is the commonly used correction. The quantity depends on the crop and soil, so use the amount on your card or from your KVK.', hi: 'जिंक सल्फेट आमतौर पर इस्तेमाल होने वाला उपाय है। मात्रा फसल और मिट्टी पर निर्भर है, इसलिए कार्ड या KVK की बताई मात्रा ही डालें।', mr: 'जस्त सल्फेट हा नेहमी वापरला जाणारा उपाय आहे. प्रमाण पीक व मातीवर अवलंबून असते; पत्रिकेवरील किंवा KVK ने सांगितलेले प्रमाणच वापरा.' },
    { en: 'Mix it with organic manure for a better effect. Zinc can last into later seasons, so re-test before repeating it.', hi: 'बेहतर असर के लिए जैविक खाद के साथ मिलाएँ। जिंक का असर अगले मौसमों तक रह सकता है, इसलिए दोबारा डालने से पहले नई जाँच कराएँ।', mr: 'चांगल्या परिणामासाठी सेंद्रिय खतात मिसळा. जस्ताचा परिणाम पुढील हंगामातही राहू शकतो, म्हणून पुन्हा देण्यापूर्वी नवी चाचणी करा.' },
  ] },
  fe: { steps: [
    { en: 'Iron shortage is common in alkaline and limy soils. Organic manure helps. For a standing crop, ask your KVK about a leaf spray.', hi: 'आयरन की कमी क्षारीय और चूनेदार मिट्टी में आम है। जैविक खाद मदद करती है। खड़ी फसल के लिए पत्तियों पर छिड़काव के बारे में KVK से पूछें।', mr: 'क्षारयुक्त व चुनखडीयुक्त जमिनीत लोहाची कमतरता सामान्य आहे. सेंद्रिय खत मदत करते. उभ्या पिकासाठी फवारणीबद्दल KVK ला विचारा.' },
    FOLLOW_CARD,
  ] },
  cu: { steps: MICRO_STEPS },
  mn: { steps: MICRO_STEPS },
  b: { steps: [
    { en: 'Boron has a very narrow safe range. A little corrects a shortage, a little extra harms the crop. Use only the recommended quantity.', hi: 'बोरॉन की सुरक्षित सीमा बहुत संकरी है। थोड़ा कमी दूर करता है, थोड़ा ज़्यादा फसल को नुकसान पहुँचाता है। केवल सुझाई गई मात्रा डालें।', mr: 'बोरॉनचे सुरक्षित प्रमाण अगदी मर्यादित आहे. थोडे कमतरता दूर करते, थोडे जास्त पिकाला हानी करते. फक्त शिफारस केलेले प्रमाण वापरा.' },
    FOLLOW_CARD,
  ] },
};

// Shown once for N / P / K / S that rate "high".
export const HIGH_ADVICE = {
  en: 'You do not need to add these now. Skipping or reducing them saves money and avoids harm. Follow the Soil Health Card recommendation for your crop.',
  hi: 'अभी इन्हें डालने की ज़रूरत नहीं। न डालने या कम डालने से पैसा बचता है और नुकसान से बचाव होता है। अपनी फसल के लिए मृदा स्वास्थ्य कार्ड की सिफारिश मानें।',
  mr: 'हे आता देण्याची गरज नाही. न दिल्याने किंवा कमी दिल्याने पैसे वाचतात व हानी टळते. तुमच्या पिकासाठी मृदा आरोग्य पत्रिकेतील शिफारस पाळा.',
};
export const HIGH_CANDIDATES = ['n', 'p', 'k', 's'];

// Returns the advice block for a parameter that needs attention, or null if nothing to do.
export function adviceFor(id, status) {
  if (id === 'ph') {
    if (status === 'acid' || status === 'strong_acid') return ADVICE.acid;
    if (status === 'alkaline') return ADVICE.alkaline;
    if (status === 'strong_alkaline') return ADVICE.strong_alkaline;
    return null;
  }
  if (id === 'ec') return status === 'normal' ? null : ADVICE.salt;
  if (status === 'low' || status === 'deficient') return ADVICE[id] || null;
  return null;
}

// ------------------------------------------------------------------ Soil type guidance (matches planner soil ids)
export const SOIL_IDS = ['black', 'red', 'loamy', 'sandy', 'clayey'];   // order is the tie-break order
export const SOIL_ICON = { black: '⚫', red: '🟤', loamy: '🟫', sandy: '🏖️', clayey: '🧱' };

export const SOIL_TIPS = {
  black: {
    desc: { en: 'Deep, dark, clay-rich soil that holds a lot of moisture and cracks when dry. Common in Maharashtra, Madhya Pradesh and Gujarat.', hi: 'गहरी, काली, चिकनी मिट्टी जो खूब नमी रखती है और सूखने पर फट जाती है। महाराष्ट्र, मध्य प्रदेश और गुजरात में आम।', mr: 'खोल, काळी, चिकण-प्रधान माती जी भरपूर ओलावा धरून ठेवते व कोरडी झाल्यावर भेगा पडतात. महाराष्ट्र, मध्य प्रदेश, गुजरातमध्ये सामान्य.' },
    tips: [
      { en: 'Do not plough or walk on it when wet. It turns sticky and hard. Wait until it just crumbles.', hi: 'गीली हालत में जुताई न करें और न चलें। यह चिपचिपी और कठोर हो जाती है। जब हल्की भुरभुरी हो तब काम करें।', mr: 'ओली असताना नांगरू नका व तुडवू नका. ती चिकट व कडक होते. वापसा आल्यावरच मशागत करा.' },
      { en: 'In heavy-rain years make drainage furrows or raised beds. Waterlogging hurts many crops here.', hi: 'भारी बारिश वाले साल में जल निकास की नालियाँ या ऊँची क्यारियाँ बनाएँ। यहाँ जलभराव कई फसलों को नुकसान पहुँचाता है।', mr: 'जास्त पावसाच्या वर्षी निचऱ्याचे चर किंवा रुंद वाफे करा. पाणी साचल्याने अनेक पिकांना फटका बसतो.' },
      { en: 'Usually rich in potassium and lime but low in nitrogen and organic matter. A test shows what to add.', hi: 'आमतौर पर पोटाश और चूने से भरपूर पर नाइट्रोजन और जैविक पदार्थ में कम। जाँच से पता चलेगा क्या डालना है।', mr: 'सहसा पालाश व चुना भरपूर पण नत्र व सेंद्रिय पदार्थ कमी. चाचणीतून काय द्यायचे ते कळेल.' },
    ],
  },
  red: {
    desc: { en: 'Lighter, well-drained soil with a red or brown colour from iron. Holds less water than black soil.', hi: 'आयरन के कारण लाल या भूरे रंग की हल्की, अच्छे जल निकास वाली मिट्टी। काली मिट्टी से कम पानी रखती है।', mr: 'लोहामुळे लाल किंवा तपकिरी रंगाची हलकी, चांगला निचरा असलेली माती. काळ्या मातीपेक्षा कमी पाणी धरते.' },
    tips: [
      { en: 'Often low in nitrogen, phosphorus and organic matter. Regular compost makes a big difference.', hi: 'अक्सर नाइट्रोजन, फॉस्फोरस और जैविक पदार्थ में कम। नियमित कम्पोस्ट से बड़ा फर्क पड़ता है।', mr: 'अनेकदा नत्र, स्फुरद व सेंद्रिय पदार्थ कमी. नियमित कंपोस्टने मोठा फरक पडतो.' },
      { en: 'Mulch to hold moisture, and if you irrigate, use short, frequent irrigations.', hi: 'नमी बनाए रखने के लिए मल्च बिछाएँ और सिंचाई करें तो हल्की व बार-बार करें।', mr: 'ओलावा टिकवण्यासाठी आच्छादन करा आणि सिंचन करत असाल तर हलके व वारंवार करा.' },
      { en: 'Often slightly acidic. Check pH before choosing crops.', hi: 'अक्सर हल्की अम्लीय। फसल चुनने से पहले pH जाँचें।', mr: 'अनेकदा सौम्य आम्लयुक्त. पीक निवडण्यापूर्वी pH तपासा.' },
    ],
  },
  loamy: {
    desc: { en: 'Balanced mix of sand, silt and clay. Holds water yet drains well. The easiest soil to manage.', hi: 'रेत, गाद और चिकनी मिट्टी का संतुलित मेल। पानी रखती है और निकास भी अच्छा। सँभालने में सबसे आसान।', mr: 'वाळू, गाळ व चिकणमातीचे संतुलित मिश्रण. पाणी धरते व निचराही चांगला. सांभाळण्यास सर्वात सोपी.' },
    tips: [
      { en: 'Keep it that way: add organic matter every season and rotate crops.', hi: 'ऐसा ही बनाए रखें: हर मौसम जैविक पदार्थ डालें और फसल चक्र अपनाएँ।', mr: 'अशीच ठेवा: दर हंगामात सेंद्रिय पदार्थ द्या व पिकांची फेरपालट करा.' },
      { en: 'Test every 2–3 years to catch nutrient drift early.', hi: 'पोषक तत्वों में बदलाव जल्दी पकड़ने के लिए हर 2–3 साल में जाँच करें।', mr: 'अन्नद्रव्यांतील बदल लवकर कळण्यासाठी दर २–३ वर्षांनी चाचणी करा.' },
      { en: 'Avoid growing the same crop family every season. It builds up pests.', hi: 'हर मौसम एक ही कुल की फसल न लें। इससे कीट बढ़ते हैं।', mr: 'दर हंगामात एकाच कुळातील पीक घेऊ नका. त्यामुळे कीड वाढते.' },
    ],
  },
  sandy: {
    desc: { en: 'Light, loose soil that drains very fast. Warms early but holds little water and few nutrients.', hi: 'हल्की, ढीली मिट्टी जिसमें पानी बहुत जल्दी निकल जाता है। जल्दी गर्म होती है पर पानी और पोषक तत्व कम रखती है।', mr: 'हलकी, सैल माती जिच्यातून पाणी खूप लवकर निघून जाते. लवकर तापते पण पाणी व अन्नद्रव्ये कमी धरते.' },
    tips: [
      { en: 'Add plenty of compost or farmyard manure. It is the best way to hold water and nutrients.', hi: 'खूब कम्पोस्ट या गोबर की खाद डालें। पानी और पोषक तत्व रोकने का यही सबसे अच्छा तरीका है।', mr: 'भरपूर कंपोस्ट किंवा शेणखत द्या. पाणी व अन्नद्रव्ये धरून ठेवण्याचा हा सर्वोत्तम मार्ग.' },
      { en: 'Give fertiliser in smaller, more frequent doses. Big doses wash out below the roots.', hi: 'उर्वरक कम मात्रा में, बार-बार दें। एक साथ ज़्यादा डालने पर वह जड़ों के नीचे बह जाता है।', mr: 'खत कमी प्रमाणात, वारंवार द्या. एकदम जास्त दिल्यास ते मुळांच्या खाली वाहून जाते.' },
      { en: 'Mulch, and use light, frequent irrigation or drip if possible.', hi: 'मल्च बिछाएँ और संभव हो तो हल्की, बार-बार सिंचाई या ड्रिप अपनाएँ।', mr: 'आच्छादन करा आणि शक्य असल्यास हलके, वारंवार सिंचन किंवा ठिबक वापरा.' },
    ],
  },
  clayey: {
    desc: { en: 'Heavy, fine-grained soil that holds water for long and drains slowly. Sticky when wet, hard when dry.', hi: 'भारी, बारीक कणों वाली मिट्टी जो पानी देर तक रोकती है और निकास धीमा है। गीली में चिपचिपी, सूखी में कठोर।', mr: 'जड, बारीक कणांची माती जी पाणी खूप वेळ धरते व निचरा हळू. ओली असताना चिकट, कोरडी असताना कडक.' },
    tips: [
      { en: 'Make drainage channels and avoid working it when wet. It compacts and forms clods.', hi: 'जल निकास की नालियाँ बनाएँ और गीली हालत में काम न करें। यह दब जाती है और ढेले बनते हैं।', mr: 'निचऱ्याचे चर करा व ओली असताना मशागत टाळा. माती दबते व ढेकळे बनतात.' },
      { en: 'Organic matter loosens it over time. Compost, farmyard manure and green manure all help.', hi: 'जैविक पदार्थ समय के साथ इसे ढीला करते हैं। कम्पोस्ट, गोबर की खाद और हरी खाद सब मदद करते हैं।', mr: 'सेंद्रिय पदार्थांनी कालांतराने ती सैल होते. कंपोस्ट, शेणखत व हिरवळीचे खत सर्व उपयोगी.' },
      { en: 'Watch salt build-up and high pH, especially in irrigated fields. A test will tell you.', hi: 'खासकर सिंचित खेतों में लवण जमा होने और ऊँचे pH पर नज़र रखें। जाँच से पता चलेगा।', mr: 'विशेषतः बागायत शेतात क्षार साचणे व जास्त pH यावर लक्ष ठेवा. चाचणीतून कळेल.' },
    ],
  },
};

// ------------------------------------------------------------------ Find my soil type quiz
// Each option adds points to one or more soils. Colour and cracking are the main
// separators between black and clayey (black soils are clay-rich too), so those carry weight.
export const QUIZ = [
  {
    title: { en: 'Colour of your soil when dry', hi: 'सूखी हालत में मिट्टी का रंग', mr: 'कोरडी असताना मातीचा रंग' },
    help: { en: 'Pick up a dry clod from the field and look at it in daylight.', hi: 'खेत से सूखा ढेला उठाएँ और दिन की रोशनी में देखें।', mr: 'शेतातून कोरडे ढेकूळ घ्या आणि दिवसाच्या प्रकाशात पहा.' },
    options: [
      { swatch: '#2b2a28', points: { black: 5, clayey: 1 }, text: { en: 'Black or very dark grey', hi: 'काली या बहुत गहरी स्लेटी', mr: 'काळी किंवा खूप गडद राखाडी' } },
      { swatch: '#a8573a', points: { red: 3 }, text: { en: 'Red, orange or reddish-brown', hi: 'लाल, नारंगी या लाल-भूरी', mr: 'लाल, केशरी किंवा लालसर तपकिरी' } },
      { swatch: '#6b4a32', points: { loamy: 3, clayey: 1 }, text: { en: 'Medium or dark brown', hi: 'मध्यम या गहरी भूरी', mr: 'मध्यम किंवा गडद तपकिरी' } },
      { swatch: '#d9c9a3', points: { sandy: 3, loamy: 1 }, text: { en: 'Pale, light brown or yellowish', hi: 'हल्की, फीकी भूरी या पीली', mr: 'फिकट, हलकी तपकिरी किंवा पिवळसर' } },
      { swatch: '#8b8d8c', points: { clayey: 3 }, text: { en: 'Grey or greyish-brown', hi: 'स्लेटी या स्लेटी-भूरी', mr: 'राखाडी किंवा राखाडी-तपकिरी' } },
    ],
  },
  {
    title: { en: 'How it feels when wet and rubbed', hi: 'गीली करके मसलने पर कैसी लगती है', mr: 'ओली करून चोळल्यावर कशी वाटते' },
    help: { en: 'Wet a pinch of soil and rub it between thumb and finger.', hi: 'चुटकी भर मिट्टी गीली करें और अँगूठे व उँगली के बीच मसलें।', mr: 'चिमूटभर माती ओली करून अंगठा व बोट यांच्यात चोळा.' },
    options: [
      { icon: '🏜️', points: { sandy: 3 }, text: { en: 'Gritty; falls apart and will not hold a shape', hi: 'किरकिरी; बिखर जाती है, आकार नहीं पकड़ती', mr: 'किरकिरीत; विखरते, आकार धरत नाही' } },
      { icon: '🤲', points: { loamy: 3, red: 1 }, text: { en: 'Smooth and soft; holds a shape but breaks when rolled thin', hi: 'चिकनी-मुलायम; आकार पकड़ती है पर पतली बत्ती बनाने पर टूटती है', mr: 'मऊ, गुळगुळीत; आकार धरते पण पातळ वळताच तुटते' } },
      { icon: '🧵', points: { clayey: 3, black: 2 }, text: { en: 'Very sticky; rolls into a long thin thread', hi: 'बहुत चिपचिपी; लंबी पतली बत्ती बन जाती है', mr: 'खूप चिकट; लांब पातळ दोरी वळता येते' } },
    ],
  },
  {
    title: { en: 'The field in the dry season', hi: 'सूखे मौसम में खेत', mr: 'कोरड्या हंगामात शेत' },
    help: { en: 'Think of May–June, or after the rains stop.', hi: 'मई–जून या बारिश रुकने के बाद को याद करें।', mr: 'मे–जून किंवा पाऊस थांबल्यानंतरचा विचार करा.' },
    options: [
      { icon: '⚡', points: { black: 3, clayey: 1 }, text: { en: 'Wide, deep cracks you can put a finger into', hi: 'चौड़ी, गहरी दरारें जिनमें उँगली जाए', mr: 'रुंद, खोल भेगा ज्यात बोट जाते' } },
      { icon: '🧱', points: { loamy: 1, clayey: 1, red: 1 }, text: { en: 'Fine cracks or a hard crust on top', hi: 'बारीक दरारें या ऊपर कठोर पपड़ी', mr: 'बारीक भेगा किंवा वर कडक कवच' } },
      { icon: '🌾', points: { sandy: 2, red: 2, loamy: 1 }, text: { en: 'No cracks; loose or crumbly', hi: 'दरारें नहीं; ढीली या भुरभुरी', mr: 'भेगा नाहीत; सैल किंवा भुसभुशीत' } },
    ],
  },
  {
    title: { en: 'After a heavy rain', hi: 'तेज़ बारिश के बाद', mr: 'जोरदार पावसानंतर' },
    help: { en: 'Watch how water behaves in the field.', hi: 'देखें खेत में पानी कैसे व्यवहार करता है।', mr: 'शेतात पाणी कसे वागते ते पहा.' },
    options: [
      { icon: '🌊', points: { clayey: 3, black: 1 }, text: { en: 'Water stands for days; very sticky mud', hi: 'पानी दिनों तक रुकता है; बहुत चिपचिपा कीचड़', mr: 'पाणी दिवसेंदिवस साचते; खूप चिकट चिखल' } },
      { icon: '💧', points: { loamy: 3, red: 1 }, text: { en: 'Soaks in at a steady pace; no long puddles', hi: 'धीरे-धीरे सोख लेती है; लंबे समय तक पानी नहीं रुकता', mr: 'सावकाश मुरते; पाणी फार वेळ साचत नाही' } },
      { icon: '💨', points: { sandy: 3, red: 2 }, text: { en: 'Drains away fast; surface dries within hours', hi: 'पानी जल्दी निकल जाता है; ऊपर कुछ घंटों में सूख जाती है', mr: 'पाणी लवकर निघून जाते; वरचा भाग काही तासांत कोरडा होतो' } },
    ],
  },
  {
    title: { en: 'Jar test (optional)', hi: 'जार जाँच (वैकल्पिक)', mr: 'बरणी चाचणी (ऐच्छिक)' },
    help: { en: 'Fill a clear jar one-third with soil, add water, shake well and leave it for a day. Then look at the layers.', hi: 'पारदर्शी जार का एक-तिहाई मिट्टी से भरें, पानी डालें, खूब हिलाएँ और एक दिन रखें। फिर परतें देखें।', mr: 'पारदर्शक बरणी एक-तृतीयांश मातीने भरा, पाणी घाला, नीट हलवा व एक दिवस ठेवा. मग थर पहा.' },
    options: [
      { icon: '⏳', points: { sandy: 3 }, text: { en: 'Mostly sand at the bottom; water turns clear quickly', hi: 'नीचे ज़्यादातर रेत; पानी जल्दी साफ़ हो जाता है', mr: 'खाली बहुतेक वाळू; पाणी लवकर निवळते' } },
      { icon: '🥣', points: { loamy: 3 }, text: { en: 'Clear layers of sand, silt and clay in similar amounts', hi: 'रेत, गाद और चिकनी मिट्टी की साफ़ परतें, लगभग बराबर', mr: 'वाळू, गाळ व चिकणमातीचे स्पष्ट थर, जवळपास सारखे' } },
      { icon: '🫗', points: { clayey: 3, black: 1 }, text: { en: 'Thick clay layer on top; water stays muddy for days', hi: 'ऊपर मोटी चिकनी परत; पानी दिनों तक गंदला रहता है', mr: 'वर जाड चिकणमातीचा थर; पाणी दिवसेंदिवस गढूळ राहते' } },
      { icon: '🪨', points: { red: 3 }, text: { en: 'Reddish water; gravel or stones at the bottom', hi: 'लालिमा लिए पानी; नीचे कंकड़ या पत्थर', mr: 'लालसर पाणी; खाली खडी किंवा दगड' } },
      { icon: '🤷', points: {}, text: { en: 'I have not tried this', hi: 'मैंने यह नहीं किया', mr: 'मी हे केलेले नाही' } },
    ],
  },
];

// answers: array of selected option indexes (null/undefined = unanswered).
// Returns null when nothing points anywhere; otherwise { soil, confidence, also, totals }.
export function scoreSoil(answers) {
  const totals = Object.fromEntries(SOIL_IDS.map((id) => [id, 0]));
  QUIZ.forEach((q, i) => {
    const opt = q.options[answers[i]];
    if (!opt) return;
    for (const [soil, pts] of Object.entries(opt.points || {})) totals[soil] += pts;
  });
  const ranked = SOIL_IDS.map((id, idx) => ({ id, idx, score: totals[id] }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  const [top, second] = ranked;
  if (!top || top.score === 0) return null;
  const gap = top.score - second.score;
  return {
    soil: top.id,
    confidence: gap >= 4 ? 'strong' : 'likely',
    also: second.score >= 3 && gap <= 2 ? second.id : null,
    totals,
  };
}
