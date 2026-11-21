/**
 * Navigation API (Chrome, Edge, Safari et Firefox récents) : vrai s'il existe une
 * page précédente de l'app dans l'historique de l'onglet. Faux sur un lien partagé
 * ou ouvert directement, et sur les navigateurs sans Navigation API.
 */
export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  const navigation = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
  return navigation?.canGoBack === true;
}
