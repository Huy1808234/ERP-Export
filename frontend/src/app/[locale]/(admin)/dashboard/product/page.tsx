import ProductTable from '@/components/admin/product/ProductTable';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { categoryService } from '@/services/category.service';

const ManageProductPage = async () => {
    const res = await categoryService.getAllPublic();
    const categories = res?.data || [];

    return (
        <AdminPageScroll>
            <ProductTable categories={categories} />
        </AdminPageScroll>
    );
}

export default ManageProductPage;
