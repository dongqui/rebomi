export const THEME_STORAGE_KEY = 'rebomi-theme'

/**
 * 첫 그리기 전에 저장된 테마를 `<html>` 에 다는 인라인 스크립트. React가 뜨기를 기다리면
 * 밝은 화면이 먼저 보였다가 어두워진다.
 *
 * 서버 레이아웃이 문자열로 읽어야 해서 `'use client'` 인 `theme.ts` 와 파일을 나눴다.
 */
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
