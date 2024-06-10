import React from 'react'
type PropsType = {
  data: {
    name: string
  }
}
export default function App({ data }: PropsType) {
  return <div className="text-red-500 p-2 text-xl">Hello, ${data.name}!</div>
}
