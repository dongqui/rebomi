import { useLocales } from 'expo-localization'
import { stringsFor, type Strings } from './strings'

/** 기기 언어에 맞는 문구. 기기 설정이 바뀌면 다시 그린다. */
export function useStrings(): Strings {
  return stringsFor(useLocales()[0]?.languageCode)
}
