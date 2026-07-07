import { remoteSignup, remoteLogin, remoteChangePassword, remoteSetName } from '@/services/cloudAuth'

export interface AuthUser {
  id: string
  username: string
  name: string
  onboarded: boolean
  sync_key?: string
  avatar?: string
}

interface StoredUser {
  id: string
  username: string
  password: string
  name: string
  onboarded: boolean
  sync_key?: string
  avatar?: string
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem('auth_users') ?? '[]')
  } catch {
    return []
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem('auth_users', JSON.stringify(users))
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('auth_current')
    if (!raw) return null
    const user = JSON.parse(raw) as AuthUser
    const users = getUsers()
    const stored = users.find(u => u.id === user.id)
    if (!stored) return null
    return { id: stored.id, username: stored.username, name: stored.name, onboarded: stored.onboarded, sync_key: stored.sync_key, avatar: stored.avatar }
  } catch {
    return null
  }
}

function setCurrentUser(user: AuthUser) {
  localStorage.setItem('auth_current', JSON.stringify(user))
}

/** Stable cross-device sync key for a username/password account. */
function syncKeyForUsername(username: string): string {
  return `u_${username.trim().toLowerCase()}`
}

/**
 * Create an account. Stored in Supabase (username + bcrypt password) so it can
 * be used from any device, and mirrored locally for offline use. If Supabase is
 * unreachable the account is created locally and pushed up on the next login.
 */
export async function signup(username: string, password: string): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const uname = username.trim()
  const users = getUsers()
  if (users.find(u => u.username.toLowerCase() === uname.toLowerCase())) {
    return { ok: false, error: 'Ese usuario ya existe' }
  }

  const syncKey = syncKeyForUsername(uname)
  const remote = await remoteSignup(uname, password, '')
  if (remote.status === 'taken') {
    return { ok: false, error: 'Ese usuario ya existe' }
  }
  // 'ok' or 'network' (offline) both proceed: create the local mirror. An
  // offline account migrates to the cloud on the next successful login.
  const key = remote.status === 'ok' ? (remote.account.sync_key || syncKey) : syncKey

  const id = crypto.randomUUID()
  const newUser: StoredUser = { id, username: uname, password, name: '', onboarded: false, sync_key: key }
  users.push(newUser)
  saveUsers(users)
  const authUser: AuthUser = { id, username: uname, name: '', onboarded: false, sync_key: key }
  setCurrentUser(authUser)
  return { ok: true, user: authUser }
}

/**
 * Log in. Validates against Supabase first (so the account works on any device);
 * falls back to the local mirror when the cloud rejects it as unknown (legacy
 * accounts, migrated on success) or is unreachable (offline).
 */
export async function login(username: string, password: string): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const uname = username.trim()
  const syncKey = syncKeyForUsername(uname)

  const remote = await remoteLogin(uname, password)

  if (remote.status === 'ok') {
    const key = remote.account.sync_key || syncKey
    const authUser = upsertLocalUser(uname, password, remote.account.name, key)
    return { ok: true, user: authUser }
  }

  const users = getUsers()
  const found = users.find(u => u.username.toLowerCase() === uname.toLowerCase())

  if (remote.status === 'invalid') {
    // Cloud says no match. Accept a local legacy account and migrate it up.
    if (found && found.password === password) {
      void remoteSignup(uname, password, found.name)
      const authUser = upsertLocalUser(uname, password, found.name, found.sync_key || syncKey)
      return { ok: true, user: authUser }
    }
    return { ok: false, error: 'Usuario o contraseña incorrectos' }
  }

  // Network error — fall back to local so the app still works offline.
  if (found) {
    if (found.password !== password) return { ok: false, error: 'Usuario o contraseña incorrectos' }
    const authUser: AuthUser = { id: found.id, username: found.username, name: found.name, onboarded: found.onboarded, sync_key: found.sync_key || syncKey }
    setCurrentUser(authUser)
    return { ok: true, user: authUser }
  }
  return { ok: false, error: 'No hay conexión y la cuenta no está en este dispositivo' }
}

/** Create or refresh the local mirror of an account and set it as current. */
function upsertLocalUser(username: string, password: string, name: string, syncKey: string): AuthUser {
  const users = getUsers()
  let user = users.find(u => u.username.toLowerCase() === username.toLowerCase())
  if (!user) {
    user = { id: crypto.randomUUID(), username, password, name, onboarded: false, sync_key: syncKey }
    users.push(user)
  } else {
    user.password = password
    user.sync_key = syncKey
    if (name && !user.name) user.name = name
  }
  saveUsers(users)
  const authUser: AuthUser = { id: user.id, username: user.username, name: user.name, onboarded: user.onboarded, sync_key: user.sync_key }
  setCurrentUser(authUser)
  return authUser
}

export function logout() {
  localStorage.removeItem('auth_current')
}

export function completeOnboarding(name: string) {
  const users = getUsers()
  const current = getCurrentUser()
  if (!current) return
  const user = users.find(u => u.id === current.id)
  if (user) {
    user.onboarded = true
    user.name = name
    saveUsers(users)
    setCurrentUser({ ...current, name, onboarded: true })
    localStorage.setItem('onboarded_flag', '1')
    if (user.password !== '') void remoteSetName(user.username, name)
  }
}

export function loginWithGoogle(credential: string): { ok: true; user: AuthUser } | { ok: false; error: string } {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1]))
    const email = payload.email as string
    const googleName = (payload.name as string) ?? ''
    // Google's stable, unguessable user id — used as the cross-device sync key.
    const sub = (payload.sub as string) ?? ''
    const syncKey = sub ? `g_${sub}` : `e_${email.toLowerCase()}`
    const users = getUsers()
    let found = users.find(u => u.username.toLowerCase() === email.toLowerCase())
    if (!found) {
      const id = crypto.randomUUID()
      found = { id, username: email, password: '', name: googleName, onboarded: false, sync_key: syncKey }
      users.push(found)
      saveUsers(users)
    } else if (!found.sync_key) {
      found.sync_key = syncKey
      saveUsers(users)
    }
    const authUser: AuthUser = { id: found.id, username: found.username, name: found.name, onboarded: found.onboarded, sync_key: found.sync_key }
    setCurrentUser(authUser)
    return { ok: true, user: authUser }
  } catch {
    return { ok: false, error: 'Error al iniciar sesión con Google' }
  }
}

/** Marks the current user as onboarded — used after cloud sync restores an existing profile. */
export function markOnboarded() {
  const users = getUsers()
  const current = getCurrentUser()
  if (!current) return
  const user = users.find(u => u.id === current.id)
  if (user && !user.onboarded) {
    user.onboarded = true
    saveUsers(users)
    setCurrentUser({ ...current, onboarded: true })
  }
}

export function updateUserName(name: string) {
  const users = getUsers()
  const current = getCurrentUser()
  if (!current) return
  const user = users.find(u => u.id === current.id)
  if (user) {
    user.name = name
    saveUsers(users)
    setCurrentUser({ ...current, name })
    window.dispatchEvent(new Event('freshapp:user'))
    if (user.password !== '') void remoteSetName(user.username, name)
  }
}

/** Saves a profile photo (data URL) for the current user. */
export function updateUserAvatar(avatar: string) {
  const users = getUsers()
  const current = getCurrentUser()
  if (!current) return
  const user = users.find(u => u.id === current.id)
  if (user) {
    user.avatar = avatar
    saveUsers(users)
    setCurrentUser({ ...current, avatar })
    window.dispatchEvent(new Event('freshapp:user'))
  }
}

/** True when the current user signs in with a password (not Google). */
export function hasPassword(): boolean {
  const current = getCurrentUser()
  if (!current) return false
  const user = getUsers().find(u => u.id === current.id)
  return !!user && user.password !== ''
}

export async function changePassword(current: string, next: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const users = getUsers()
  const authed = getCurrentUser()
  if (!authed) return { ok: false, error: 'No hay sesión activa' }
  const user = users.find(u => u.id === authed.id)
  if (!user) return { ok: false, error: 'Usuario no encontrado' }
  if (user.password === '') return { ok: false, error: 'Tu cuenta inicia sesión con Google; la contraseña se gestiona allí' }
  if (user.password !== current) return { ok: false, error: 'La contraseña actual es incorrecta' }
  if (next.length < 4) return { ok: false, error: 'La nueva contraseña debe tener mínimo 4 caracteres' }

  // Update the cloud password so the new one works on other devices too.
  const write = await remoteChangePassword(user.username, current, next)
  if (!write.ok && write.reason === 'network') {
    return { ok: false, error: 'No se pudo actualizar en la nube (sin conexión). Intenta más tarde.' }
  }

  user.password = next
  saveUsers(users)
  return { ok: true }
}
