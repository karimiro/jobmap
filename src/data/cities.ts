export type City = {
  id: string;
  nameFr: string;
  nameAr: string;
  region: string;
  lat: number;
  lng: number;
};

// Major Moroccan cities with coordinates (lat, lng)
export const CITIES: City[] = [
  { id: "casablanca", nameFr: "Casablanca", nameAr: "الدار البيضاء", region: "الدار البيضاء - سطات", lat: 33.5731, lng: -7.5898 },
  { id: "rabat", nameFr: "Rabat", nameAr: "الرباط", region: "الرباط - سلا - القنيطرة", lat: 34.0209, lng: -6.8416 },
  { id: "sale", nameFr: "Salé", nameAr: "سلا", region: "الرباط - سلا - القنيطرة", lat: 34.0531, lng: -6.7987 },
  { id: "kenitra", nameFr: "Kénitra", nameAr: "القنيطرة", region: "الرباط - سلا - القنيطرة", lat: 34.261, lng: -6.5802 },
  { id: "marrakech", nameFr: "Marrakech", nameAr: "مراكش", region: "مراكش - آسفي", lat: 31.6295, lng: -7.9811 },
  { id: "fes", nameFr: "Fès", nameAr: "فاس", region: "فاس - مكناس", lat: 34.0331, lng: -5.0003 },
  { id: "meknes", nameFr: "Meknès", nameAr: "مكناس", region: "فاس - مكناس", lat: 33.8935, lng: -5.5473 },
  { id: "tanger", nameFr: "Tanger", nameAr: "طنجة", region: "طنجة - تطوان - الحسيمة", lat: 35.7595, lng: -5.834 },
  { id: "tetouan", nameFr: "Tétouan", nameAr: "تطوان", region: "طنجة - تطوان - الحسيمة", lat: 35.5785, lng: -5.3684 },
  { id: "agadir", nameFr: "Agadir", nameAr: "أكادير", region: "سوس - ماسة", lat: 30.4278, lng: -9.5981 },
  { id: "oujda", nameFr: "Oujda", nameAr: "وجدة", region: "الشرق", lat: 34.6867, lng: -1.9114 },
  { id: "safi", nameFr: "Safi", nameAr: "آسفي", region: "مراكش - آسفي", lat: 32.2994, lng: -9.2376 },
  { id: "eljadida", nameFr: "El Jadida", nameAr: "الجديدة", region: "الدار البيضاء - سطات", lat: 33.2316, lng: -8.5008 },
  { id: "beni-mellal", nameFr: "Béni Mellal", nameAr: "بني ملال", region: "بني ملال - خنيفرة", lat: 32.3373, lng: -6.3498 },
  { id: "nador", nameFr: "Nador", nameAr: "الناظور", region: "الشرق", lat: 35.1681, lng: -2.9287 },
  { id: "khouribga", nameFr: "Khouribga", nameAr: "خريبكة", region: "بني ملال - خنيفرة", lat: 32.8859, lng: -6.9088 },
  { id: "settat", nameFr: "Settat", nameAr: "سطات", region: "الدار البيضاء - سطات", lat: 33.0011, lng: -7.6166 },
  { id: "essaouira", nameFr: "Essaouira", nameAr: "الصويرة", region: "مراكش - آسفي", lat: 31.5085, lng: -9.7595 },
  { id: "ouarzazate", nameFr: "Ouarzazate", nameAr: "ورزازات", region: "درعة - تافيلالت", lat: 30.9335, lng: -6.937 },
  { id: "errachidia", nameFr: "Errachidia", nameAr: "الرشيدية", region: "درعة - تافيلالت", lat: 31.9314, lng: -4.4244 },
  { id: "alhoceima", nameFr: "Al Hoceïma", nameAr: "الحسيمة", region: "طنجة - تطوان - الحسيمة", lat: 35.2517, lng: -3.9372 },
  { id: "guelmim", nameFr: "Guelmim", nameAr: "كلميم", region: "كلميم - واد نون", lat: 28.987, lng: -10.0574 },
  { id: "laayoune", nameFr: "Laâyoune", nameAr: "العيون", region: "العيون - الساقية الحمراء", lat: 27.1253, lng: -13.1625 },
  { id: "dakhla", nameFr: "Dakhla", nameAr: "الداخلة", region: "الداخلة - وادي الذهب", lat: 23.6848, lng: -15.9579 },
];
