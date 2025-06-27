import { useState, useEffect } from 'react'

function PokemonData() {
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(1)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersResponse, postsResponse] = await Promise.all([
        fetch('https://jsonplaceholder.typicode.com/users'),
        fetch(`https://jsonplaceholder.typicode.com/posts?userId=${selectedUserId}`)
      ])
      
      if (!usersResponse.ok || !postsResponse.ok) {
        throw new Error('Failed to fetch data')
      }
      
      const usersData = await usersResponse.json()
      const postsData = await postsResponse.json()
      
      setUsers(usersData)
      setPosts(postsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedUserId])

  const selectRandomUser = () => {
    const randomUserId = Math.floor(Math.random() * 10) + 1
    setSelectedUserId(randomUserId)
  }

  if (loading) {
    return (
      <div data-test-id="user-data-loading" style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading user data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div data-test-id="user-data-error" style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <p>Error: {error}</p>
        <button onClick={fetchData} data-test-id="retry-button-ready">
          Retry
        </button>
      </div>
    )
  }

  const selectedUser = users.find(user => user.id === selectedUserId)

  return (
    <div data-test-id="user-data-container" style={{
      maxWidth: '800px',
      margin: '20px auto',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          onClick={selectRandomUser} 
          data-test-id={loading ? "random-user-button-loading" : "random-user-button-ready"}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '20px'
          }}
        >
          {loading ? 'Loading...' : 'Select Random User'}
        </button>
      </div>

      {selectedUser && (
        <div data-test-id="user-profile" style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #eee'
        }}>
          <h2 data-test-id="user-name" style={{ marginTop: 0, color: '#333' }}>
            {selectedUser.name}
          </h2>
          
          <div data-test-id="user-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <p><strong>Username:</strong> <span data-test-id="user-username">{selectedUser.username}</span></p>
              <p><strong>Email:</strong> <span data-test-id="user-email">{selectedUser.email}</span></p>
              <p><strong>Phone:</strong> <span data-test-id="user-phone">{selectedUser.phone}</span></p>
              <p><strong>Website:</strong> <span data-test-id="user-website">{selectedUser.website}</span></p>
            </div>
            
            <div data-test-id="user-address">
              <p><strong>Address:</strong></p>
              <p data-test-id="address-street">{selectedUser.address.street} {selectedUser.address.suite}</p>
              <p data-test-id="address-city">{selectedUser.address.city}, {selectedUser.address.zipcode}</p>
              <p><strong>Company:</strong> <span data-test-id="user-company">{selectedUser.company.name}</span></p>
            </div>
          </div>
        </div>
      )}

      <div data-test-id="user-posts">
        <h3 data-test-id="posts-title">Posts by {selectedUser?.name} ({posts.length})</h3>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {posts.map((post, index) => (
            <div 
              key={post.id}
              data-test-id={`post-${index}`}
              style={{
                backgroundColor: 'white',
                padding: '15px',
                marginBottom: '10px',
                borderRadius: '6px',
                border: '1px solid #eee'
              }}
            >
              <h4 data-test-id={`post-title-${index}`} style={{ 
                marginTop: 0, 
                marginBottom: '10px',
                color: '#444',
                textTransform: 'capitalize'
              }}>
                {post.title}
              </h4>
              <p data-test-id={`post-body-${index}`} style={{ 
                margin: 0, 
                lineHeight: '1.5',
                color: '#666'
              }}>
                {post.body}
              </p>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                <span data-test-id={`post-id-${index}`}>Post ID: {post.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PokemonData