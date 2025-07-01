import { useEffect, useState } from "react";

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
  };
  company: {
    name: string;
  };
}

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

function MockUserApp() {
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(1);
  const [postsExpanded, setPostsExpanded] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [availableOptions, setAvailableOptions] = useState([
    { id: 1, label: "Option Alpha", value: "alpha" },
    { id: 2, label: "Option Beta", value: "beta" },
    { id: 3, label: "Option Gamma", value: "gamma" },
    { id: 4, label: "Option Delta", value: "delta" },
    { id: 5, label: "Option Epsilon", value: "epsilon" }
  ]);
  const [selectedOption, setSelectedOption] = useState<string>("Select an option...");
  const [searchText, setSearchText] = useState<string>("");
  const [messageText, setMessageText] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, postsResponse] = await Promise.all([
        fetch("https://jsonplaceholder.typicode.com/users"),
        fetch(
          `https://jsonplaceholder.typicode.com/posts?userId=${selectedUserId}`,
        ),
      ]);

      if (!usersResponse.ok || !postsResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      const usersData: User[] = await usersResponse.json();
      const postsData: Post[] = await postsResponse.json();

      setUsers(usersData);
      setPosts(postsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedUserId]);

  const selectRandomUser = () => {
    const randomUserId = Math.floor(Math.random() * 10) + 1;
    setSelectedUserId(randomUserId);
  };

  const nextUser = () => {
    setSelectedUserId(prev => prev < 10 ? prev + 1 : 1);
  };

  const prevUser = () => {
    setSelectedUserId(prev => prev > 1 ? prev - 1 : 10);
  };

  const loadFirstUser = () => {
    setSelectedUserId(1);
  };

  const fetchUserWithXHR = () => {
    setLoading(true);
    setError(null);
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `https://jsonplaceholder.typicode.com/users/${selectedUserId}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const userData: User = JSON.parse(xhr.responseText);
          setUsers(prevUsers => {
            const newUsers = [...prevUsers];
            const index = newUsers.findIndex(u => u.id === userData.id);
            if (index !== -1) {
              newUsers[index] = userData;
            } else {
              newUsers.push(userData);
            }
            return newUsers;
          });
        } catch (err) {
          setError('Failed to parse user data');
        }
      } else {
        setError(`Failed to fetch user: ${xhr.status}`);
      }
      setLoading(false);
    };
    
    xhr.onerror = () => {
      setError('Network error occurred');
      setLoading(false);
    };
    
    xhr.send();
  };

  const handleDropdownSelect = (option: { id: number; label: string; value: string }) => {
    setSelectedOption(option.label);
    setShowDropdown(false);
    // Remove the selected option from available options (causing DOM disappearance)
    setAvailableOptions(prev => prev.filter(opt => opt.id !== option.id));
  };

  const resetDropdown = () => {
    setAvailableOptions([
      { id: 1, label: "Option Alpha", value: "alpha" },
      { id: 2, label: "Option Beta", value: "beta" },
      { id: 3, label: "Option Gamma", value: "gamma" },
      { id: 4, label: "Option Delta", value: "delta" },
      { id: 5, label: "Option Epsilon", value: "epsilon" }
    ]);
    setSelectedOption("Select an option...");
    setShowDropdown(false);
  };

  if (loading) {
    return (
      <div
        data-test-id="user-data-loading"
        style={{ padding: "20px", textAlign: "center" }}
      >
        <p>Loading user data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-test-id="user-data-error"
        style={{ padding: "20px", textAlign: "center", color: "red" }}
      >
        <p>Error: {error}</p>
        <button onClick={fetchData} data-test-id="retry-button-ready">
          Retry
        </button>
      </div>
    );
  }

  const selectedUser = users.find((user) => user.id === selectedUserId);

  return (
    <div
      data-test-id="user-data-container"
      style={{
        maxWidth: "800px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        backgroundColor: "#f9f9f9",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <p data-test-id="user-counter" style={{ marginBottom: "15px", color: "#666" }}>
          Current user: {selectedUserId}/10
        </p>
        
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={loadFirstUser}
            data-test-id={loading
              ? "load-first-user-button-loading"
              : "load-first-user-button-ready"}
            disabled={loading}
            style={{
              padding: "10px 15px",
              backgroundColor: loading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "First User"}
          </button>

          <button
            onClick={prevUser}
            data-test-id={loading
              ? "prev-user-button-loading"
              : "prev-user-button-ready"}
            disabled={loading}
            style={{
              padding: "10px 15px",
              backgroundColor: loading ? "#ccc" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "← Previous"}
          </button>

          <button
            onClick={nextUser}
            data-test-id={loading
              ? "next-user-button-loading"
              : "next-user-button-ready"}
            disabled={loading}
            style={{
              padding: "10px 15px",
              backgroundColor: loading ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Next →"}
          </button>

          <button
            onClick={selectRandomUser}
            data-test-id={loading
              ? "random-user-button-loading"
              : "random-user-button-ready"}
            disabled={loading}
            style={{
              padding: "10px 15px",
              backgroundColor: loading ? "#ccc" : "#ff6b6b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Random"}
          </button>

          <button
            onClick={fetchUserWithXHR}
            data-test-id={loading
              ? "xhr-user-button-loading"
              : "xhr-user-button-ready"}
            disabled={loading}
            style={{
              padding: "10px 15px",
              backgroundColor: loading ? "#ccc" : "#ffc107",
              color: "black",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Reload with XHR"}
          </button>

          <button
            onClick={() => setShowTestModal(true)}
            data-test-id="test-modal-button"
            style={{
              padding: "10px 15px",
              backgroundColor: "#9c27b0",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Test Modal
          </button>
        </div>
      </div>

      {/* Disappearing Dropdown for Testing Edge Cases */}
      <div 
        data-test-id="dropdown-container"
        style={{
          position: "relative",
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #eee"
        }}
      >
        <h3 data-test-id="dropdown-title" style={{ marginTop: 0, marginBottom: "10px", color: "#333" }}>
          Disappearing Dropdown Test
        </h3>
        <p data-test-id="dropdown-description" style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
          Select an option to make it disappear from the DOM (tests edge case handling)
        </p>
        
        <div style={{ position: "relative", display: "inline-block", minWidth: "200px" }}>
          <button
            data-test-id="dropdown-trigger"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              padding: "10px 15px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span data-test-id="dropdown-selected-text">{selectedOption}</span>
            <span data-test-id="dropdown-arrow" style={{ fontSize: "12px" }}>
              {showDropdown ? "▲" : "▼"}
            </span>
          </button>
          
          {showDropdown && (
            <div
              data-test-id="dropdown-menu"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: "white",
                border: "1px solid #ced4da",
                borderTop: "none",
                borderRadius: "0 0 4px 4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                zIndex: 1000,
                maxHeight: "200px",
                overflowY: "auto"
              }}
            >
              {availableOptions.length === 0 ? (
                <div 
                  data-test-id="dropdown-no-options"
                  style={{
                    padding: "10px 15px",
                    color: "#999",
                    fontStyle: "italic"
                  }}
                >
                  No options remaining
                </div>
              ) : (
                availableOptions.map((option) => (
                  <div
                    key={option.id}
                    data-test-id={`dropdown-option-${option.value}`}
                    onClick={() => handleDropdownSelect(option)}
                    style={{
                      padding: "10px 15px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.backgroundColor = "#f8f9fa";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.backgroundColor = "white";
                    }}
                  >
                    {option.label}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span data-test-id="dropdown-remaining-count" style={{ fontSize: "12px", color: "#999" }}>
            Options remaining: {availableOptions.length}
          </span>
          <button
            data-test-id="dropdown-reset-button"
            onClick={resetDropdown}
            style={{
              padding: "5px 10px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Reset Options
          </button>
        </div>
      </div>

      {/* Keyboard Input Testing */}
      <div 
        data-test-id="keyboard-test-container"
        style={{
          position: "relative",
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #eee"
        }}
      >
        <h3 data-test-id="keyboard-test-title" style={{ marginTop: 0, marginBottom: "10px", color: "#333" }}>
          Keyboard Input Testing
        </h3>
        <p data-test-id="keyboard-test-description" style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
          Test keyboard recording with various input types and key combinations
        </p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
          <div>
            <label 
              data-test-id="search-input-label"
              style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}
            >
              Search Input:
            </label>
            <input
              data-test-id="search-input"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Type here and press Enter to search..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  console.log('Search triggered:', searchText);
                }
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
            {searchText && (
              <div data-test-id="search-preview" style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
                Preview: "{searchText}"
              </div>
            )}
          </div>
          
          <div>
            <label 
              data-test-id="message-input-label"
              style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}
            >
              Message Input:
            </label>
            <textarea
              data-test-id="message-input"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message here... Try Ctrl+A to select all"
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                resize: "vertical"
              }}
            />
          </div>
        </div>
        
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button
            data-test-id="clear-search-button"
            onClick={() => setSearchText("")}
            style={{
              padding: "6px 12px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Clear Search
          </button>
          <button
            data-test-id="clear-message-button"
            onClick={() => setMessageText("")}
            style={{
              padding: "6px 12px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Clear Message
          </button>
          <button
            data-test-id="copy-to-search-button"
            onClick={() => setSearchText(messageText)}
            disabled={!messageText}
            style={{
              padding: "6px 12px",
              backgroundColor: messageText ? "#28a745" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: messageText ? "pointer" : "not-allowed",
              fontSize: "12px"
            }}
          >
            Copy Message to Search
          </button>
        </div>
        
        <div style={{ fontSize: "12px", color: "#999" }}>
          <div data-test-id="keyboard-tips">
            <strong>Test these keyboard interactions:</strong>
          </div>
          <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
            <li>Type regular text in the inputs</li>
            <li>Press Enter in the search field</li>
            <li>Use Ctrl+A (Cmd+A on Mac) to select all text</li>
            <li>Use Ctrl+C and Ctrl+V to copy/paste</li>
            <li>Try Tab to navigate between fields</li>
            <li>Use arrow keys to move cursor</li>
            <li>Test Escape, Backspace, Delete keys</li>
          </ul>
        </div>
      </div>

      {selectedUser && (
        <div
          data-test-id="user-profile"
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #eee",
          }}
        >
          <h2 data-test-id="user-name" style={{ marginTop: 0, color: "#333" }}>
            {selectedUser.name}
          </h2>

          <div
            data-test-id="user-info"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <p>
                <strong>Username:</strong>{" "}
                <span data-test-id="user-username">
                  {selectedUser.username}
                </span>
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <span data-test-id="user-email">{selectedUser.email}</span>
              </p>
              <p>
                <strong>Phone:</strong>{" "}
                <span data-test-id="user-phone">{selectedUser.phone}</span>
              </p>
              <p>
                <strong>Website:</strong>{" "}
                <span data-test-id="user-website">{selectedUser.website}</span>
              </p>
            </div>

            <div data-test-id="user-address">
              <p>
                <strong>Address:</strong>
              </p>
              <p data-test-id="address-street">
                {selectedUser.address.street} {selectedUser.address.suite}
              </p>
              <p data-test-id="address-city">
                {selectedUser.address.city}, {selectedUser.address.zipcode}
              </p>
              <p>
                <strong>Company:</strong>{" "}
                <span data-test-id="user-company">
                  {selectedUser.company.name}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div data-test-id="user-posts">
        <div
          data-test-id={postsExpanded
            ? "posts-header-expanded"
            : "posts-header-collapsed"}
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            marginBottom: postsExpanded ? "15px" : "0",
          }}
          onClick={() => setPostsExpanded(!postsExpanded)}
        >
          <span
            data-test-id={postsExpanded
              ? "posts-toggle-expanded"
              : "posts-toggle-collapsed"}
            style={{
              marginRight: "8px",
              fontSize: "16px",
              userSelect: "none",
            }}
          >
            {postsExpanded ? "▼" : "▶"}
          </span>
          <h3 data-test-id="posts-title" style={{ margin: 0 }}>
            Posts by {selectedUser?.name} ({posts.length})
          </h3>
        </div>

        {postsExpanded && (
          <div
            data-test-id="posts-content"
            style={{ maxHeight: "400px", overflowY: "auto" }}
          >
            {posts.map((post, index) => (
              <div
                key={post.id}
                data-test-id={`post-${index}`}
                style={{
                  backgroundColor: "white",
                  padding: "15px",
                  marginBottom: "10px",
                  borderRadius: "6px",
                  border: "1px solid #eee",
                }}
              >
                <h4
                  data-test-id={`post-title-${index}`}
                  style={{
                    marginTop: 0,
                    marginBottom: "10px",
                    color: "#444",
                    textTransform: "capitalize",
                  }}
                >
                  {post.title}
                </h4>
                <p
                  data-test-id={`post-body-${index}`}
                  style={{
                    margin: 0,
                    lineHeight: "1.5",
                    color: "#666",
                  }}
                >
                  {post.body}
                </p>
                <div
                  style={{ marginTop: "10px", fontSize: "12px", color: "#999" }}
                >
                  <span data-test-id={`post-id-${index}`}>
                    Post ID: {post.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Modal to demonstrate SnapTest UI stays on top */}
      {showTestModal && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setShowTestModal(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
              zIndex: 10000,
              minWidth: "400px",
              textAlign: "center",
            }}
          >
            <h2 data-test-id="modal-title" style={{ marginTop: 0, marginBottom: "20px" }}>
              Test Modal with High Z-Index
            </h2>
            <p data-test-id="modal-description" style={{ marginBottom: "20px", color: "#666" }}>
              This modal has z-index: 10000, but SnapTest UI should still be visible on top with z-index: 2147483647!
            </p>
            <button
              onClick={() => setShowTestModal(false)}
              data-test-id="close-modal-button"
              style={{
                padding: "10px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Close Modal
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default MockUserApp;
