export interface AuthUser {
  id: string
  username: string
  name: string
  onboarded: boolean
  sync_key?: string
}

interface StoredUser {
  id: string
  username: string
  password: string
  name: string
  onboarded: boolean
  sync_key?: string
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
    return { id: stored.id, username: stored.username, name: stored.name, onboarded: stored.onboarded, sync_key: stored.sync_key }
  } catch {
    return null
  }
}

function setCurrentUser(user: AuthUser) {
  localStorage.setItem('auth_current', JSON.stringify(user))
}

export function signup(username: string, password: string): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const users = getUsers()
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: 'Ese usuario ya existe' }
  }
  const id = crypto.randomUUID()
  const newUser: StoredUser = { id, username, password, name: '', onboarded: false }
  users.push(newUser)
  saveUsers(users)
  const authUser: AuthUser = { id, username, name: '', onboarded: false }
  setCurrentUser(authUser)
  return { ok: true, user: authUser }
}

export function login(username: string, password: string): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const users = getUsers()
  const found = users.find(u => u.username.toLowerCase() === username.toLowerCase())
  if (!found || found.password !== password) {
    return { ok: false, error: 'Usuario o contraseña incorrectos' }
  }
  const authUser: AuthUser = { id: found.id, username: found.username, name: found.name, onboarded: found.onboarded }
  setCurrentUser(authUser)
  return { ok: true, user: authUser }
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
  }
}
