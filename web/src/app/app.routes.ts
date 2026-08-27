import { Routes } from '@angular/router';
import { MatchingScreen } from './matching/matching-screen';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'matching' },
  { path: 'matching', component: MatchingScreen, title: 'Matching' },
  { path: '**', redirectTo: 'matching' },
];
