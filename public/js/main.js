document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    // 获取DOM元素
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const gallery = document.getElementById('gallery');
    const uploadArea = document.getElementById('uploadArea');
    const uploadModal = document.getElementById('uploadModal');
    const imageModal = document.getElementById('imageModal');
    const confirmDialog = document.getElementById('confirmDialog');
    const filePreview = document.getElementById('filePreview');
    const imageNameInput = document.getElementById('imageName');
    const imageTagsInput = document.getElementById('imageTags');
    const confirmUploadBtn = document.getElementById('confirmUpload');
    const cancelUploadBtn = document.getElementById('cancelUpload');

    // 创建Toast提示组件
    const createToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 添加动画类
        setTimeout(() => toast.classList.add('show'), 10);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    };

    // 状态变量
    let currentPage = 1;
    const itemsPerPage = 12;
    let currentImages = [];
    let selectedFile = null;
    let currentImageId = null;

    // 工具函数：防抖
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // API函数
    async function fetchImages() {
        try {
            const searchQuery = searchInput.value;
            const sortBy = sortSelect.value;
            const category = document.querySelector('.category-tag.active')?.dataset.category || 'all';
            
            const response = await fetch(`/api/images?search=${encodeURIComponent(searchQuery)}&sort=${sortBy}&category=${category}`);
            if (!response.ok) throw new Error('获取图片列表失败');
            
            const images = await response.json();
            currentImages = images;
            renderGallery();
        } catch (error) {
            createToast(error.message, 'error');
        }
    }

    async function uploadImage(file) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                createToast('请先登录后再上传图片', 'warning');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
                return;
            }

            const formData = new FormData();
            formData.append('image', file);
            formData.append('customName', imageNameInput.value || file.name);
            formData.append('tags', imageTagsInput.value);

            const progressBar = document.querySelector('.progress');
            progressBar.parentElement.style.display = 'block';
            progressBar.style.width = '0%';

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '上传失败');
            }

            progressBar.style.width = '100%';
            const result = await response.json();
            
            closeUploadModal();
            await fetchImages();
            createToast('上传成功！', 'success');

            setTimeout(() => {
                progressBar.style.width = '0%';
                progressBar.parentElement.style.display = 'none';
            }, 1000);

        } catch (error) {
            createToast(error.message, 'error');
            document.querySelector('.progress').style.width = '0%';
            document.querySelector('.progress-bar').style.display = 'none';
        }
    }

    async function likeImage(imageId) {
        if (!imageId) {
            console.error('无效的图片ID');
            return;
        }
    
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                createToast('请先登录', 'warning');
                window.location.href = '/login.html';
                return;
            }
    
            const response = await fetch(`/api/images/${imageId}/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                if (response.status === 401) {
                    createToast('登录已过期，请重新登录', 'warning');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error('点赞失败');
            }
    
            const data = await response.json();
            
            // 更新内存中的图片数据
            const imageIndex = currentImages.findIndex(img => img.id === imageId);
            if (imageIndex !== -1) {
                currentImages[imageIndex].likes = data.likes;
            }
            
            updateAllLikeCounts(imageId, data.likes, data.isLiked);
            
        } catch (error) {
            console.error('点赞失败:', error);
            createToast('操作失败，请重试', 'error');
        }
    }

    async function deleteImage(imageId) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                createToast('请先登录后再删除图片', 'warning');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
                return;
            }

            const response = await fetch(`/api/images/${imageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('删除失败');
            
            closeImageModal();
            await fetchImages();
            createToast('删除成功', 'success');
        } catch (error) {
            createToast(error.message, 'error');
        }
    }

    // 渲染函数
    function renderGallery() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageImages = currentImages.slice(startIndex, endIndex);

        if (currentImages.length === 0) {
            gallery.innerHTML = `
                <div class="gallery-empty">
                    <img src="/images/Goe ovo.png" alt="Not Found" class="empty-image">
                    <div class="empty-text">鸠...好像没有找到呢</div>
                </div>
            `;
            return;
        }        

        gallery.innerHTML = pageImages.map((image, index) => `
            <div class="gallery-item" style="animation-delay: ${index * 0.1}s">
                <div class="image-container">
                    <img src="${image.path}" alt="${image.originalname}" data-image-id="${image.id}">
                </div>
                <div class="gallery-item-info">
                    <div class="gallery-item-header">
                        <h3 class="gallery-item-title">${image.originalname}</h3>
                    </div>
                    <div class="gallery-item-tags">
                        ${(image.tags || []).map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                    <button class="like-btn" data-image-id="${image.id}">
                        <span class="like-icon">♥</span>
                        <span class="like-count">${image.likes || 0}</span>
                    </button>
                </div>
            </div>
        `).join('');

        // 添加事件监听器
        document.querySelectorAll('.gallery-item .image-container img').forEach(img => {
            img.addEventListener('click', () => {
                const image = currentImages.find(i => i.id === img.dataset.imageId);
                if (image) {
                    showImage(image.path, image.originalname, image.id, image.likes || 0, image.tags || []);
                }
            });
        });

        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const imageId = btn.dataset.imageId;
                if (imageId) {
                    await likeImage(imageId);
                }
            });
        });

        updatePagination();
    }

    function updatePagination() {
        const totalPages = Math.ceil(currentImages.length / itemsPerPage);
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');
        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;
    }

    function updateAllLikeCounts(imageId, likes, isLiked) {
        if (!imageId) return;
    
        // 更新网格中的点赞数
        const galleryLikeBtn = document.querySelector(`.like-btn[data-image-id="${imageId}"]`);
        if (galleryLikeBtn) {
            const likeCount = galleryLikeBtn.querySelector('.like-count');
            if (likeCount) {
                likeCount.textContent = likes;
            }
            if (isLiked) {
                galleryLikeBtn.classList.add('liked');
            } else {
                galleryLikeBtn.classList.remove('liked');
            }
        }
    
        // 更新模态框中的点赞数
        const modalLikeBtn = imageModal.querySelector('.like-btn');
        if (modalLikeBtn && modalLikeBtn.dataset.imageId === imageId) {
            const modalLikeCount = modalLikeBtn.querySelector('.like-count');
            if (modalLikeCount) {
                modalLikeCount.textContent = likes;
            }
            if (isLiked) {
                modalLikeBtn.classList.add('liked');
            } else {
                modalLikeBtn.classList.remove('liked');
            }
        }
    }

    // 模态框函数
    window.showImage = function(src, title, imageId, likes, tags) {
        if (!src || !imageId) {
            console.error('Invalid image data:', { src, title, imageId, likes, tags });
            return;
        }

        // 从内存中获取最新的图片数据
        const currentImage = currentImages.find(img => img.id === imageId);
        if (currentImage) {
            likes = currentImage.likes || 0;
        }

        const modalImg = imageModal.querySelector('img');
        const modalTitle = imageModal.querySelector('.image-title');
        const modalTags = imageModal.querySelector('.image-tags');
        const likeBtn = imageModal.querySelector('.like-btn');
        
        modalImg.src = src;
        modalTitle.textContent = title || 'Untitled';
        likeBtn.dataset.imageId = imageId;
        likeBtn.querySelector('.like-count').textContent = likes;

        // 清除之前的事件监听器
        const oldLikeBtn = imageModal.querySelector('.like-btn');
        const newLikeBtn = oldLikeBtn.cloneNode(true);
        oldLikeBtn.parentNode.replaceChild(newLikeBtn, oldLikeBtn);
        
        // 添加新的事件监听器
        newLikeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = newLikeBtn.dataset.imageId;
            if (id) {
                await likeImage(id);
            }
        });
        
        // 获取点赞状态
        const token = localStorage.getItem('token');
        if (token) {
            fetch(`/api/images/${imageId}/like`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to get like status');
                return response.json();
            })
            .then(data => {
                if (data.isLiked) {
                    newLikeBtn.classList.add('liked');
                } else {
                    newLikeBtn.classList.remove('liked');
                }
            })
            .catch(error => {
                console.error('获取点赞状态失败:', error);
            });
        }

        modalTags.innerHTML = Array.isArray(tags) ? tags.map(tag => `
            <span class="tag">${tag}</span>
        `).join('') : '';
        
        currentImageId = imageId;
        imageModal.classList.add('active');
        setTimeout(() => {
            imageModal.querySelector('.modal-content').style.transform = 'scale(1)';
            imageModal.querySelector('.modal-content').style.opacity = '1';
        }, 10);
    }

    function closeImageModal() {
        const modalContent = imageModal.querySelector('.modal-content');
        modalContent.style.transform = 'scale(0.8)';
        modalContent.style.opacity = '0';
        setTimeout(() => {
            imageModal.classList.remove('active');
            currentImageId = null;
        }, 300);
    }

    function showUploadModal(file) {
        selectedFile = file;
        imageNameInput.value = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            filePreview.innerHTML = `<img src="${e.target.result}" alt="预览">`;
        };
        reader.readAsDataURL(file);
        
        uploadModal.classList.add('active');
        setTimeout(() => {
            uploadModal.querySelector('.upload-modal-content').style.transform = 'scale(1)';
            uploadModal.querySelector('.upload-modal-content').style.opacity = '1';
        }, 10);
    }

    function closeUploadModal() {
        const modalContent = uploadModal.querySelector('.upload-modal-content');
        modalContent.style.transform = 'scale(0.8)';
        modalContent.style.opacity = '0';
        setTimeout(() => {
            uploadModal.classList.remove('active');
            selectedFile = null;
            filePreview.innerHTML = '';
            imageNameInput.value = '';
            imageTagsInput.value = '';
        }, 300);
    }

    async function downloadImage(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = objectUrl;
            link.download = imageModal.querySelector('.image-title').textContent;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
            
            createToast('下载开始', 'success');
        } catch (error) {
            createToast('下载失败', 'error');
        }
    }

    // 事件监听
    searchInput?.addEventListener('input', debounce(() => {
        currentPage = 1;
        fetchImages();
    }, 300));

    sortSelect?.addEventListener('change', fetchImages);

    document.querySelectorAll('.category-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelector('.category-tag.active')?.classList.remove('active');
            tag.classList.add('active');
            currentPage = 1;
            fetchImages();
        });
    });

    document.querySelector('.prev-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderGallery();
        }
    });

    document.querySelector('.next-btn')?.addEventListener('click', () => {
        if (currentPage < Math.ceil(currentImages.length / itemsPerPage)) {
            currentPage++;
            renderGallery();
        }
    });

    // 上传相关事件
    uploadArea?.addEventListener('click', () => {
        const token = localStorage.getItem('token');
        if (!token) {
            createToast('请先登录后再上传图片', 'warning');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                showUploadModal(file);
            }
        };
        input.click();
    });

    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const token = localStorage.getItem('token');
        if (!token) {
            createToast('请先登录后再上传图片', 'warning');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
            return;
        }

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            showUploadModal(file);
        } else {
            createToast('请上传图片文件', 'error');
        }
    });

    // 模态框中的按钮事件
    imageModal.querySelector('.like-btn')?.addEventListener('click', () => {
        const imageId = imageModal.querySelector('.like-btn').dataset.imageId;
        if (imageId) {
            likeImage(imageId);
        }
    });

    imageModal.querySelector('.download-btn')?.addEventListener('click', () => {
        const imgSrc = imageModal.querySelector('img').src;
        if (imgSrc) {
            downloadImage(imgSrc);
        }
    });

    imageModal.querySelector('.delete-btn')?.addEventListener('click', () => {
        if (currentImageId) {
            confirmDialog.classList.add('active');
        }
    });

    confirmDialog.querySelector('.cancel-btn')?.addEventListener('click', () => {
        confirmDialog.classList.remove('active');
    });

    confirmDialog.querySelector('.confirm-btn')?.addEventListener('click', () => {
        if (currentImageId) {
            deleteImage(currentImageId);
            confirmDialog.classList.remove('active');
        }
    });

    // 关闭按钮事件
    imageModal.querySelector('.close')?.addEventListener('click', closeImageModal);
    confirmUploadBtn?.addEventListener('click', () => {
        if (selectedFile) {
            uploadImage(selectedFile);
        } else {
            createToast('请选择要上传的图片', 'error');
        }
    });
    cancelUploadBtn?.addEventListener('click', closeUploadModal);

    // 点击模态框背景关闭
    imageModal?.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeImageModal();
        }
    });

    confirmDialog?.addEventListener('click', (e) => {
        if (e.target === confirmDialog) {
            confirmDialog.classList.remove('active');
        }
    });

    uploadModal?.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            closeUploadModal();
        }
    });

    // 初始加载
    fetchImages();
});

function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    const userInfo = document.getElementById('userInfo');
    const loginButton = document.getElementById('loginButton');
    const username = document.getElementById('username');
    
    if (token && user) {
        userInfo.style.display = 'inline';
        loginButton.style.display = 'none';
        username.textContent = user.username;
    } else {
        userInfo.style.display = 'none';
        loginButton.style.display = 'inline';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    checkLoginStatus();
    window.location.reload();
}
