// Private utility functions
const addChannelSubscriber = (channel, fn, filterFn, once) => {
  subscriptions[channel] = subscriptions[channel] || {}
  const id = nextId++
  const stopFn = createStopFn(channel, id)
  const newFn = once !== true ? fn : (message) => (stopFn() && fn(message))
  subscriptions[channel][id] = { fn: newFn, filterFn }
  return stopFn
}
const createStopFn = (channel, id) => () => delete subscriptions[channel][id]
const sendMessageToSubscribers = (channel, message) => {
  if (!subscriptions[channel]) return
  Object.keys(subscriptions[channel]).forEach((key) => {
    const sub = subscriptions[channel][key]
    if (sub.filterFn) {
      if (!sub.filterFn(message)) return
    }
    setTimeout(((sub) => sub.fn(message))(sub), 0)
  })
}
const sendMessageToMiddlewares = (channel, message, source) => {
  middlewares.forEach((mw) => {
    setTimeout((() => mw(channel, message, source))(mw), 0)
  })
}
const wrapReduxMiddleware = (mw) => {
  return (send) => {
    const dispatch = (action) => send(action.type, action)
    const store = { getState: () => null, dispatch }
    const partialMw = mw(store)
    return (channel, message, source) => {
      const action = Object.assign({}, message, {type: channel, source: source})
      const next = () => {}
      partialMw(next)(action)
    }
  }
}

// Exposed bus methods
const take = (channel, fn, filterFn = null, once = false) => {
  if (!channel || !fn) return false
  return addChannelSubscriber(channel, fn, filterFn, once)
}
const one = (channel, fn, filterFn) => take(channel, fn, filterFn, true)
const send = (channel, message, source = 'app') => {
  if (!channel) return
  sendMessageToSubscribers(channel, message)
  sendMessageToMiddlewares(channel, message, source)
}

// Local variables / constants
let nextId = 0
const subscriptions = {}
const middlewares = []
const bus = { take, one, send }

// Exported functions
export const getBus = () => bus
export const createReduxMiddleware = () => (next) => (action) => {
  bus.send(action.type, action, 'redux')
  return next(action)
}
export function applyMiddleware () {
  Array.from(arguments).forEach((arg) => middlewares.push(arg(send)))
}
export function applyReduxMiddleware () {
  Array.from(arguments).forEach((arg) => {
    const compat = wrapReduxMiddleware(arg)(send)
    middlewares.push(compat)
  })
}

